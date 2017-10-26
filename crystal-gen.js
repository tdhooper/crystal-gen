var THREE = require('three');
var mda = require('mda');
var sliceThreeGeometry = require('threejs-slice-geometry')(THREE);
var vec3 = require('gl-matrix').vec3;
var ThreeBSP = require('ThreeCSG')(THREE);
var random = require('seed-random');


function topPlane(slope, angle, point) {
    var normal = new THREE.Vector3(
        0,
        Math.cos( (slope * .5 - .5) * Math.PI),
        Math.sin( (slope * .5 - .5) * Math.PI)
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
    var engine = engine || threeEngine;
    var shape = polygon(spec.sides, spec.diameter);
    var rand = random(spec.seed, {entropy: true});

    shape.forEach(function(point) {        
        point[0] += (rand() * 2 - 1) * .2 * spec.diameter;
        point[1] += (rand() * 2 - 1) * .2 * spec.diameter;
    });

    console.log(shape);

    var geometry = engine.extrude(shape, spec.height, spec.topScale);

    var point = new THREE.Vector3(0, 0, spec.height);

    var rot = (Math.PI * 2) / (spec.topFacets * 2);

    for (var i = 0; i < spec.topFacets; i++) {
        var offset = (rand() * 2 - 1) * .05;
        var slopeOffset = (rand() * 2 - 1) * .1;
        var angle = i / spec.topFacets + rot + offset;
        var plane = topPlane(
            spec.topSlope + slopeOffset,
            angle,
            point
        );
        geometry = engine.slice(geometry, plane);
    }

    var plane = topPlane(
        spec.topSlope * .5,
        0,
        point.clone().multiplyScalar(.9)
    );
    // geometry = engine.slice(geometry, plane);

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

    extrude: function(shape, height, scale) {
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
        for (var i = 0; i < shape.length; i++) {
            var v = geometry.vertices[i + shape.length];
            v.x = v.x * scale;
            v.y = v.y * scale;
        }
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
        var addedIntersections = {};
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
            var newIndex = newPositions.length;
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

        var newIntersection = function(vert0, vert1, dist0, dist1) {
            var index0 = vert0.index;
            var index1 = vert1.index;
            var hash = [
                Math.min(index0, index1),
                Math.max(index0, index1)
            ].join(',');
            if (addedIntersections.hasOwnProperty(hash)) {
                return addedIntersections[hash];
            }
            var iv = intersect(vert0, vert1, dist0, dist1);
            var newIndex = newVert(iv);
            addedIntersections[hash] = newIndex;
            return newIndex;
        };

        mesh.faces.forEach(function(face) {
            var newIndices = [];
            console.log('FACE');

            mda.FaceHalfEdges(face).forEach(function(halfEdge) {
                var verts = mda.EdgeVertices(halfEdge.edge);

                console.log(verts[0].index, verts[1].index);

                var dist0 = vertDist(verts[0]);
                var dist1 = vertDist(verts[1]);

                console.log(dist0, dist1);

                if (dist0 > 0 && dist1 > 0) {
                    console.log('keep edge');

                    newIndices.push(addVert(verts[0]));
                    newIndices.push(addVert(verts[1]));

                } else if (dist0 > 0 && dist1 <= 0) {
                    console.log('intersect 1');

                    newIndices.push(addVert(verts[0]));

                    var vertIndex = newIntersection(verts[0], verts[1], dist0, dist1);
                    newIndices.push(vertIndex);
                    capFace.push(vertIndex);

                } else if (dist0 <= 0 && dist1 > 0) {
                    console.log('intersect 0');

                    var vertIndex = newIntersection(verts[0], verts[1], dist0, dist1);
                    newIndices.push(vertIndex);
                    capFace.push(vertIndex);

                    newIndices.push(addVert(verts[1]));

                } else {
                    console.log('discard');
                }
            });

            if (newIndices.length) {
                newFaces.push(newIndices.filter(function(item, pos) {
                    return newIndices.indexOf(item) == pos;
                }));
            }
        });

        newFaces.push(capFace.filter(function(item, pos) {
            return capFace.indexOf(item) == pos;
        }));

        console.log(newFaces);
        console.log(newPositions);

        newFaces[4] = [3, 5, 4];

        var newMesh = new mda.Mesh();
        newMesh.setPositions(newPositions);
        newMesh.setCells(newFaces);
        newMesh.process();

        mda.MeshIntegrity(newMesh);

        console.log(newMesh)

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
