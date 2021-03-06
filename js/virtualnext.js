var showInfo = false;
var selMaterial, lastMeshMaterial = false,
    lastMeshID = false,
    lastObjectMaterial = false,
    lastObjectID = false,
    targetList = [];

var sphereShape, sphereBody, world, physicsMaterial, walls = [],
    balls = [],
    ballMeshes = [],
    boxes = [],
    boxMeshes = [];

var camera, scene, renderer;
var controls, time = Date.now();
var toolTip = document.getElementById('tooltip');
var blocker = document.getElementById('blocker');
var instructions = document.getElementById('instructions');

var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

if (havePointerLock) {

    var element = document.body;

    var pointerlockchange = function (event) {

        if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {

            controls.enabled = true;

            blocker.style.display = 'none';

        } else {

            controls.enabled = false;

            blocker.style.display = '-webkit-box';
            blocker.style.display = '-moz-box';
            blocker.style.display = 'box';

            instructions.style.display = '';

        }

    }

    var pointerlockerror = function (event) {
        instructions.style.display = '';
    }

    // Hook pointer lock state change events
    document.addEventListener('pointerlockchange', pointerlockchange, false);
    document.addEventListener('mozpointerlockchange', pointerlockchange, false);
    document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

    document.addEventListener('pointerlockerror', pointerlockerror, false);
    document.addEventListener('mozpointerlockerror', pointerlockerror, false);
    document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

    instructions.addEventListener('click', function (event) {
        instructions.style.display = 'none';

        // Ask the browser to lock the pointer
        element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;

        if (/Firefox/i.test(navigator.userAgent)) {

            var fullscreenchange = function (event) {

                if (document.fullscreenElement === element || document.mozFullscreenElement === element || document.mozFullScreenElement === element) {

                    document.removeEventListener('fullscreenchange', fullscreenchange);
                    document.removeEventListener('mozfullscreenchange', fullscreenchange);

                    element.requestPointerLock();
                }
            }

            document.addEventListener('fullscreenchange', fullscreenchange, false);
            document.addEventListener('mozfullscreenchange', fullscreenchange, false);

            element.requestFullscreen = element.requestFullscreen || element.mozRequestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen;
            element.requestFullscreen();

        } else {

            element.requestFullscreen = element.requestFullscreen || element.webkitRequestFullscreen;
            element.requestFullscreen();
            element.requestPointerLock();

        }

    }, false);

} else {

    instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';

}

initCannon();
init();
animate();

function initCannon() {
    // Setup our world
    world = new CANNON.World();
    world.quatNormalizeSkip = 0;
    world.quatNormalizeFast = false;

    var solver = new CANNON.GSSolver();

    world.defaultContactMaterial.contactEquationStiffness = 1e9;
    world.defaultContactMaterial.contactEquationRelaxation = 4;

    solver.iterations = 7;
    solver.tolerance = 0.1;
    var split = true;
    if (split)
        world.solver = new CANNON.SplitSolver(solver);
    else
        world.solver = solver;

    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();

    // Create a slippery material (friction coefficient = 0.0)
    physicsMaterial = new CANNON.Material("slipperyMaterial");
    var physicsContactMaterial = new CANNON.ContactMaterial(physicsMaterial,
        physicsMaterial,
        0.0, // friction coefficient
        0.3 // restitution
    );
    // We must add the contact materials to the world
    world.addContactMaterial(physicsContactMaterial);

    // Create a sphere
    var mass = 5,
        radius = 1.3;
    sphereShape = new CANNON.Sphere(radius);
    sphereBody = new CANNON.Body({
        mass: mass
    });
    sphereBody.addShape(sphereShape);
    sphereBody.position.set(0, 1.5, 0);
    sphereBody.linearDamping = 0.999;
    world.add(sphereBody);

    // Create a plane
    var groundShape = new CANNON.Plane();
    var groundBody = new CANNON.Body({
        mass: 0
    });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.add(groundBody);
}

function init() {
    var textureLoader = new THREE.TextureLoader();

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x201177, 0, 200);

    selMaterial = new THREE.MeshBasicMaterial({
        color: 'red',
        side: '2'
    }); //color for selected mesh element

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    controls = new PointerLockControls(camera, sphereBody);
    scene.add(controls.getObject());

    // create a global ambient light object
    var ambientLight = new THREE.AmbientLight("#797979");
    ambientLight.name = "Mild ambient light";
    scene.add(ambientLight);

    var crosshairMaterial = new THREE.LineBasicMaterial({
        color: 0xAAFFAA
    });

    // crosshair size
    var x = 0.01,
        y = 0.01;

    var crosshairGeometry = new THREE.Geometry();

    // crosshair
    crosshairGeometry.vertices.push(new THREE.Vector3(0, y, 0));
    crosshairGeometry.vertices.push(new THREE.Vector3(0, -y, 0));
    crosshairGeometry.vertices.push(new THREE.Vector3(0, 0, 0));
    crosshairGeometry.vertices.push(new THREE.Vector3(x, 0, 0));
    crosshairGeometry.vertices.push(new THREE.Vector3(-x, 0, 0));

    var crosshair = new THREE.Line(crosshairGeometry, crosshairMaterial);

    // place it in the center
    var crosshairPercentX = 50;
    var crosshairPercentY = 50;
    var crosshairPositionX = (crosshairPercentX / 100) * 2 - 1;
    var crosshairPositionY = (crosshairPercentY / 100) * 2 - 1;

    crosshair.position.x = crosshairPositionX * camera.aspect;
    crosshair.position.y = crosshairPositionY;

    crosshair.position.z = -0.3;

    camera.add(crosshair);

    var modelJSON = (window.location.hash) ? window.location.hash.split('#')[1] : 'meiko';
    var loader = new THREE.ObjectLoader();
    loader.load(
        // resource URL
        "booths/" + modelJSON + ".json",

        // onLoad callback
        // Here the loaded data is assumed to be an object
        function (obj) {
            var renderingParent = new THREE.Group();
            renderingParent.scale.set(0.001, 0.001, 0.001);
            renderingParent.add(obj);

            // Add the loaded object to the scene
            scene.add(renderingParent);
            console.log('scene added');

            var geometry = new THREE.Geometry();
            renderingParent.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry instanceof THREE.Geometry) {
                        child.geometry.computeBoundingSphere();
                        // child.geometry.computeFaceNormals();
                        // child.geometry.computeVertexNormals();
                        geometry.merge(child.geometry);
                        targetList.push(child);
                    } else if (child.geometry instanceof THREE.BufferGeometry) {
                        var convertedGeometry = new THREE.Geometry();
                        convertedGeometry.fromBufferGeometry(child.geometry);
                        geometry.merge(convertedGeometry);
                        targetList.push(child);
                    }
                }

                if (false) // Box
                {
                    child.matrixWorldNeedsUpdate = true;
                    child.geometry.computeBoundingBox();
                    var boxBody = new CANNON.Body();
                    var boxSize = child.geometry.boundingBox.getSize(new THREE.Vector3());
                    var halfExtents = new CANNON.Vec3(boxSize.x, boxSize.y, boxSize.z);
                    boxBody.addShape(new CANNON.Box(halfExtents));
                    var boxPos = child.getWorldPosition(new THREE.Vector3());
                    boxBody.position.copy(boxPos);
                    world.add(boxBody);
                }
            });

            // var video = document.getElementById( 'video' );
            // var videoTexture = new THREE.VideoTexture( video );
            // videoTexture.minFilter = THREE.NearestFilter;
            // videoTexture.magFilter = THREE.NearestFilter;
            // videoTexture.format = THREE.RGBFormat;
            // var videoMaterial = new THREE.MeshBasicMaterial( { map: videoTexture } );
            // var videoCube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), videoMaterial ); 
            // videoCube.castShadow = true;
            // videoCube.position.set(-5,5,-5);
            // scene.add(videoCube);
            // video.play();

            geometry.computeBoundingSphere();
            var boundingSphere = geometry.boundingSphere;

            var offset = boundingSphere.radius * 6; // get the radius of the bounding sphere for placing lights at certain distance from the object
            var center = boundingSphere.center; // get the center of the bounding sphere for pointing lights at it

            var lightOpacity = 0.45;

            // the sun as directional light
            var sunLight = new THREE.DirectionalLight('#ffffff');
            sunLight.name = "The sun :)";
            sunLight.position.set( 0, 10, 0 );
            sunLight.target.position.set( 0, 0, 0 );
            // sunLight.position.set(center.x + offset, center.y + offset, -center.z - offset);
            // sunLight.target.position.set(center.x, center.y, center.z);

            var spotLight1 = new THREE.SpotLight('#656565', lightOpacity);
            spotLight1.castShadow = true;
            spotLight1.shadowMapDarkness = 0.2;
            spotLight1.shadow.mapSize.width = 16 * 512;
            spotLight1.shadow.mapSize.height = 16 * 512;
            spotLight1.position.set( 20, 80, 10 );
            spotLight1.target.position.set( 0, 0, 0 );
            // spotLight1.position.set(-center.x - offset / 2, center.y + offset / 1.5, -center.z - offset / 2);
            // spotLight1.target.position.set(center.x, center.y, center.z);

            var spotLight2 = new THREE.SpotLight('#606060', lightOpacity);
            spotLight2.position.set( 20, 60, 10 );
            spotLight2.target.position.set( 0, 0, 20 );
            // spotLight2.position.set(center.x + offset / 2, center.y + offset / 1.5, center.z - offset / 2);
            // spotLight2.target.position.set(center.x, center.y, center.z);

            // create 2 spotlights
            var spotLights = [spotLight1, spotLight2];
            spotLights.forEach(spotLight => {
                scene.add(spotLight);
            });

            scene.background = new THREE.Color( 0xffffff );
        },

        // onProgress callback
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },

        // onError callback
        function (err) {
            console.error('An error happened: ' + err);
        }
    );

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
    });

    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.enabled = true;
    renderer.shadowMapSoft = false;

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(scene.fog.color, 0);
    renderer.compile(scene, camera);

    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);
}

function computeNormalsAndFaces() {
    for (var i = 0; i < scene.children.length; i++) {
        if (scene.children[i].hasOwnProperty("geometry")) {
            scene.children[i].geometry.mergeVertices();
            scene.children[i].castShadow = true;
            scene.children[i].geometry.computeFaceNormals();
            targetList.push(scene.children[i]);
        }
        if (scene.children[i].children.length > 0) {
            for (var k = 0; k < scene.children[i].children.length; k++) {
                if (scene.children[i].children[k].hasOwnProperty("geometry")) {
                    targetList.push(scene.children[i].children[k]);
                }
            }
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

var dt = 1 / 60;

function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
    time = Date.now();
}

function update() {
    if (controls.enabled) {
        world.step(dt);

        // Update ball positions
        for (var i = 0; i < balls.length; i++) {
            ballMeshes[i].position.copy(balls[i].position);
            ballMeshes[i].quaternion.copy(balls[i].quaternion);
        }

        // Update box positions
        for (var i = 0; i < boxes.length; i++) {
            boxMeshes[i].position.copy(boxes[i].position);
            boxMeshes[i].quaternion.copy(boxes[i].quaternion);
        }
    }

    controls.update(Date.now() - time);
}

window.addEventListener("click", function (event) {
    if (controls.enabled != true) {
        return;
    }

    // handlerRayIntersection(event);
});

function handlerRayIntersection(event) {
    event.preventDefault();
    hideTooltip();

    var vector = new THREE.Vector3((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1, 0.5);
    vector.unproject(camera);

    var raycaster = new THREE.Raycaster();
    raycaster.set(camera.getWorldPosition(new THREE.Vector3()), camera.getWorldDirection(new THREE.Vector3()));

    var intersects = raycaster.intersectObjects(targetList);
    if (intersects.length <= 0) {
        return;
    }

    var j = 0;
    while (j < intersects.length) {

        //FOR MESHES:
        if (!isEmptyObject(intersects[j].object)) {
            showTooltip(intersects[j].object);
            break;
        }

        //FOR OBJECT3D
        if (!isEmptyObject(intersects[j].object.parent)) {
            showTooltip(intersects[j].object.parent);
            break;
        }

        j++;
    }
}

window.addEventListener('mousemove', function(event) {
    if (showInfo)
        handlerRayIntersection(event);
});

window.addEventListener('mousedown', function(event) {
    showInfo = true;
    handlerRayIntersection(event);
});

window.addEventListener('mouseup', function(event) {
    showInfo = false;
    hideTooltip();
});

function isEmptyObject(obj) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            return false;
        }
    }

    return JSON.stringify(obj) === JSON.stringify({});
}

function hideTooltip() {
    toolTip.style.display = 'none';
    toolTip.innerHTML = '';
}

function showTooltip(obj) {
    if (!controls.enabled)
        return;

    var table = document.createElement('table');
    for (var [key, value] of Object.entries(obj)) {
        if (key === 'URL Manufacturer')
        {
            setTimeout(function (){ 
                Object.assign(document.createElement('a'), { target: '_blank', href: value}).click();
            }, 10);
            showInfo = false;
            break;
        }        

        while(table.rows.length > 1) {
            table.deleteRow(1);
        }
        
        table.insertRow();
        var row = table.rows[table.rows.length - 1];
        if (key === 'Comments')
        {
            row.insertCell().textContent = value;
            break;
        }

        row.insertCell().textContent = key;
        row.insertCell().textContent = value;
    }

    if (showInfo) {
        toolTip.style.top = (window.innerHeight / 2 + 20) + 'px';
        toolTip.style.left = (window.innerWidth / 2 + 20) + 'px';
        toolTip.appendChild(table);
        toolTip.style.display = 'block';
    }
}