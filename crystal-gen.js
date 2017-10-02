var THREE = require('three');
var mda = require('mda');
var sliceThreeGeometry = require('threejs-slice-geometry')(THREE);
var vec3 = require('gl-matrix').vec3;
var ThreeBSP = require('three-js-csg')(THREE);



function topPlane(slope, angle, point) {
    var normal = new THREE.Vector3(
        0,
        Math.cos((slope - .5) * Math.PI),
        Math.sin((slope - .5) * Math.PI)
    );
    normal.applyAxisAngle(
        new THREE.Vector3(0, 0, 1),
        angle * Math.PI * 2
    );
    var plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    var basicPlane = [
        plane.normal.toArray(),
        plane.constant
    ];
    return basicPlane;
}

function create(spec, engine) {
    var shape = polygon(spec.sides, spec.diameter);
    var geometry = engine.extrude(shape, spec.height);

    var point = new THREE.Vector3(0, 0, spec.height * .5);

    var slope = .3;
    slope = 0.;

    for (var i = 0; i < spec.topFacets; i++) {
        var angle = i / spec.topFacets;
        var plane = topPlane(slope, angle, point);
        geometry = engine.slice(geometry, plane);
    }

    return engine.asThreeGeometry(geometry);
}

var ThreeEngine = function() {
    this.size = 100;
    this.box = new THREE.Mesh(new THREE.BoxGeometry(
        this.size,
        this.size,
        this.size
    ));
};

ThreeEngine.prototype = {

    extrude: function(shape, height) {
        var tShape = new THREE.Shape();
        tShape.moveTo(shape[0][0], shape[0][1]);
        shape.slice(1).forEach(function(point) {
            tShape.lineTo(point[0], point[1]);
        });
        tShape.lineTo(shape[0][0], shape[0][1]);
        var geometry = new THREE.ExtrudeGeometry(tShape, {
            steps: 1,
            amount: height,
            bevelEnabled: false
        });
        return new ThreeBSP(geometry);
    },

    slice: function(geometryBSP, plane) {
        var normal = new THREE.Vector3().fromArray(plane[0]);
        var tPlane = new THREE.Plane(normal, plane[1]);
    
        this.box.position.copy(normal);
        var dist = this.size * .5 + tPlane.constant;
        this.box.position.multiplyScalar(dist * -1);
        this.box.lookAt(normal);
    
        var boxBSP = new ThreeBSP(this.box);
        return geometryBSP.subtract(boxBSP);
    },

    asThreeGeometry: function(geometryBSP) {
        return geometryBSP.toGeometry();
    }
};

var threeEngine = new ThreeEngine();


var mdaEngine = {
    extrude: function(shape, height) {
        var mesh = mda.ProfileGenerator(shape);
        mda.ExtrudeOperator(mesh, 0, height, 0);
        return mesh;
    },
    slice: function(mesh, plane) {
        var vertBin = {};

        var normal = plane[0];
        var constant = plane[1];

        var newPositions = [];
        var newFaces = [];
        var addedVerts = {};
        var capFace = [];

        var vertDist = function(vert) {
            var v = mesh.positions[vert.index];
            var dist = vec3.dot(normal, v) - constant;
            return dist;
        };

        var addVert = function(vert) {
            var index = vert.index;
            if (addedVerts.hasOwnProperty(index)) {
                return addedVerts[index];
            }
            var newIndex = newPositions.length
            addedVerts[index] = newIndex;
            newPositions.push(mesh.positions[index]);
            return newIndex;
        };

        var newVert = function(v) {
            newPositions.push(v);
            return newPositions.length - 1;
        };

        var intersect = function(vert0, vert1, dist0, dist1) {
            var t = dist0 / (dist0 - dist1);
            var p0 = mesh.positions[vert0.index];
            var p1 = mesh.positions[vert1.index];
            var v = vec3.create();
            var intersection = vec3.lerp(v, p0, p1, t);
            return v;
        };

        mesh.faces.forEach(function(face) {
            console.log('FACE');
            var newIndices = [];

            mda.FaceHalfEdges(face).forEach(function(halfEdge) {
                var verts = mda.EdgeVertices(halfEdge.edge);

                var dist0 = vertDist(verts[0]);
                var dist1 = vertDist(verts[1]);

                if (dist0 > 0 && dist1 > 0) {
                    console.log('keep edge');

                    console.log(verts)

                    newIndices.push(addVert(verts[0]));
                    newIndices.push(addVert(verts[1]));

                } else if (dist0 > 0 && dist1 <= 0) {
                    console.log('intersect 1');

                    newIndices.push(addVert(verts[0]));

                    var iv = intersect(verts[0], verts[1], dist0, dist1);
                    var vertIndex = newVert(iv);
                    newIndices.push(vertIndex);
                    capFace.push(vertIndex);

                } else if (dist0 <= 0 && dist1 > 0) {
                    console.log('intersect 0');

                    var iv = intersect(verts[0], verts[1], dist0, dist1);
                    var vertIndex = newVert(iv);
                    newIndices.push(vertIndex);
                    capFace.push(vertIndex);

                    newIndices.push(addVert(verts[1]));

                } else {
                    console.log('discard');
                }
            });

            if (newIndices.length) {
                console.log(newIndices);
                newFaces.push(newIndices.filter(function(item, pos) {
                    return newIndices.indexOf(item) == pos;
                }));
            }
        });

        // newFaces.push(capFace.filter(function(item, pos) {
        //     return capFace.indexOf(item) == pos;
        // }));

        console.log(newFaces);
        console.log(newPositions)
        console.log(capFace);

        // newFaces.push(capFace);

        var newMesh = new mda.Mesh();
        newMesh.setPositions(newPositions);
        newMesh.setCells(newFaces);
        newMesh.process();

        mda.MeshIntegrity(newMesh);

        console.log(newMesh);

        return newMesh;
    },
    asThreeGeometry: function(mesh) {
        mda.TriangulateOperator(mesh);
        var positions = mesh.getPositions();
        var cells = mesh.getCells();
        var geometry = new THREE.Geometry();
        geometry.vertices = positions.map(function(position) {
            return new THREE.Vector3().fromArray(position);
        });
        geometry.faces = cells.map(function(cell) {
            return new THREE.Face3(cell[0], cell[1], cell[2]);
        });
        return geometry;
    }
};

function polygon(sides, size) {
    var points = Array.apply(null, Array(sides));
    points = points.map(function(u, i) {
        var angle = i / sides * Math.PI * 2.;
        return [
            Math.sin(angle) * size,
            Math.cos(angle) * size
        ];
    });
    return points;
}

module.exports = {
    create: create,
    threeEngine: threeEngine,
    mdaEngine: mdaEngine
}
