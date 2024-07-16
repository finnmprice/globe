let scene, camera, renderer, earth, controls, satellites = [], moon, cloudMesh, atmosphereMesh, directionalLight, raycaster, mouse;

function init() {
    // scene
    scene = new THREE.Scene();

    // camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 2048);
    camera.position.z = 3;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // earth
    const geometry = new THREE.SphereGeometry(1, 128, 128);

    const textureLoader = new THREE.TextureLoader();
    const diffuseMap = textureLoader.load('textures/earth_diffuse.jpg');
    const specularMap = textureLoader.load('textures/earth_specular.jpg');
    const normalMap = textureLoader.load('textures/earth_normal.jpg');

    const material = new THREE.ShaderMaterial({
        uniforms: {
            diffuseMap: { value: diffuseMap },
            specularMap: { value: specularMap },
            normalMap: { value: normalMap },
            sunDirection: { value: new THREE.Vector3(5, 3, 5).normalize() }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            void main() {
                vUv = uv;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                vNormal = normalMatrix * normal;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D diffuseMap;
            uniform sampler2D specularMap;
            uniform sampler2D normalMap;
            uniform vec3 sunDirection;
            
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                
                // normals
                vec3 normalMap = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
                normal = normalize(normal + normalMap);
                
                float diffuse = max(dot(normal, sunDirection), 0.0);
                vec3 halfVector = normalize(sunDirection + viewDir);
                float specular = pow(max(dot(normal, halfVector), 0.0), 32.0);
                
                vec3 diffuseColor = texture2D(diffuseMap, vUv).rgb;
                float specularStrength = texture2D(specularMap, vUv).r * 0.75;
                
                // lighting and textures
                vec3 color = diffuseColor * (0.1 + 0.9 * diffuse) + vec3(1.0) * specular * specularStrength;
                
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
    
    earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // clouds
    const cloudGeometry = new THREE.SphereGeometry(1.003, 128, 128);
    const cloudTexture = textureLoader.load('textures/earth_clouds.jpg');
    
    const cloudMaterial = new THREE.ShaderMaterial({
        uniforms: {
            cloudTexture: { value: cloudTexture },
            sunDirection: { value: new THREE.Vector3(5, 3, 5).normalize() }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            
            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D cloudTexture;
            uniform vec3 sunDirection;
            
            varying vec2 vUv;
            varying vec3 vNormal;
            
            void main() {
                vec4 cloudColor = texture2D(cloudTexture, vUv);
                
                // light intensity
                float intensity = max(0.0, dot(vNormal, sunDirection));
                
                // brightness of clouds on dark side
                float minBrightness = 0.1;
                
                // combine cloud color with lighting
                vec3 finalColor = cloudColor.rgb * (intensity * (1.0 - minBrightness) + minBrightness);
                
                gl_FragColor = vec4(finalColor, cloudColor.r * 0.5);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending
    });

    cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    earth.add(cloudMesh);

    // atmosphere
    const atmosphereGeometry = new THREE.SphereGeometry(1.1, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
            atmosphereColor: { value: new THREE.Vector3(0.3, 0.6, 1.0) },
            earthRadius: { value: 1.0 },
            atmosphereRadius: { value: 1.1 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,
        fragmentShader: `
            uniform vec3 atmosphereColor;
            uniform float earthRadius;
            uniform float atmosphereRadius;
            varying vec3 vWorldPosition;
            
            void main() {
                vec3 worldPosition = normalize(vWorldPosition);
                vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                
                float atmosphereThickness = atmosphereRadius - earthRadius;
                float t = atmosphereRadius - length(vWorldPosition);
                float depth = exp(-t / atmosphereThickness) * (1.0 - exp(-atmosphereThickness));
                
                float cosAngle = dot(worldPosition, viewDirection);
                float scatteringFactor = 0.05 + pow(1.0 - cosAngle, 5.0) * 0.95;
                
                float intensity = depth * scatteringFactor;
                
                gl_FragColor = vec4(atmosphereColor, 1.0) * intensity;
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });
    

    atmosphereMaterial.uniforms.earthRadius.value = 1.0;
    atmosphereMaterial.uniforms.atmosphereRadius.value = 1.1;    
    atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // moon
    const moonRadius = (1737.1 / 6371);
    const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 32);
    const moonTexture = textureLoader.load('textures/moon.jpg');
    const moonMaterial = new THREE.MeshPhongMaterial({
        map: moonTexture,
    });
    moon = new THREE.Mesh(moonGeometry, moonMaterial);
    scene.add(moon);

    // stars
    const starfieldGeometry = new THREE.SphereGeometry(1024, 64, 64);
    const starfieldTexture = textureLoader.load('textures/starfield_milky.jpg');
    const starfieldMaterial = new THREE.MeshBasicMaterial({
        map: starfieldTexture,
        side: THREE.BackSide
    });
    const starfield = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
    scene.add(starfield);

    // directional light
    directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 3, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    scene.add(directionalLight);

    earth.castShadow = true;
    earth.receiveShadow = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    updateSunPosition();

    // controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);

    controls.rotateSpeed = 0.25;
    controls.zoomSpeed = 1;
    controls.minDistance = 1.1; 
    controls.maxDistance = 100; 
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    controls.enablePan = true;

    fetchSatelliteData();
    
    // window resize
    window.addEventListener('resize', onWindowResize, false);

    renderer.domElement.addEventListener('click', onDocumentMouseClick, false);
    animate();
}

function fetchSatelliteData() {
    isFetchingData = true;
    fetch('/satellite-data')
        .then(response => response.json())
        .then(data => {
            console.log('received', data.length, 'satellites');
            satelliteQueue = data;
            if (!isProcessingQueue) {
                processSatelliteQueue();
            }
        })
        .catch(error => console.error('error:', error))
        .finally(() => {
            isFetchingData = false;
        });
}

let satelliteQueue = [];
let isProcessingQueue = false;

const BATCH_SIZE = 1000;

function processSatelliteQueue() {
    if (satelliteQueue.length === 0) {
        isProcessingQueue = false;
        updateLoadingIndicator();
        return;
    }

    isProcessingQueue = true;
    
    const batch = satelliteQueue.splice(0, BATCH_SIZE);
    batch.forEach(satelliteData => {
        addSatellite(satelliteData);
    });

    updateLoadingIndicator();

    setTimeout(processSatelliteQueue, 80);
}

function updateLoadingIndicator() {
    const totalSatellites = satelliteQueue.length + satellites.length;
    const loadedSatellites = satellites.length;
    const progressPercentage = (loadedSatellites / totalSatellites) * 100;

    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.width = `${progressPercentage}%`;
        loadingIndicator.textContent = `${loadedSatellites}/${totalSatellites}`;
    }

    if (loadedSatellites === totalSatellites) {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

function addSatellite(satelliteData) {
    try {
        const name = satelliteData.name;
        const satrec = satellite.twoline2satrec(satelliteData.line1, satelliteData.line2);
        const date = new Date();
        const positionAndVelocity = satellite.propagate(satrec, date);
        
        if (positionAndVelocity.position === false || positionAndVelocity.velocity === false) {
            console.warn('invalid satellite pos:', name);
            return;
        }

        const gmst = satellite.gstime(date);
        const position = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

        const lat = satellite.degreesLat(position.latitude);
        const lon = satellite.degreesLong(position.longitude);
        const alt = position.height / 6371; // km to earth radii

        const satelliteGeometry = new THREE.SphereGeometry(0.0025, 8, 8);

        const satelliteColor = satelliteData.type === 'starlink' ? '#18DE1B' :
        satelliteData.type === 'debris' ? '#EB413D' : satelliteData.type === 'weather' ? '#EB9E02' :
        satelliteData.type === 'communication' ? '#12EBE7' : '#fff';

        const satelliteMaterial = new THREE.MeshBasicMaterial({ color: satelliteColor });
        const satelliteMesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);

        const pos = latLongToVector3(lat, lon, 1 + alt);
        satelliteMesh.position.copy(pos);

        // click event listener
        satelliteMesh.userData.name = name;
        satelliteMesh.userData.type = satelliteData.type;
        satelliteMesh.userData.description = satelliteData.description;
        satelliteMesh.callback = function() {
            if (this.popup) {
                removeSatellitePopup(this);
            }
            this.popup = createSatellitePopup(this.userData, this);
            
            setTimeout(() => {
                removeSatellitePopup(this);
            }, 5000);
        };

        earth.add(satelliteMesh);
        satellites.push({mesh: satelliteMesh, satrec: satrec, name: name, type: satelliteMesh.userData.type});
    } catch (error) {
        console.warn('error adding satellite:', satelliteData.name, error);
    }
}


function updateSatellitePositions() {
    if (typeof satellite === 'undefined' || satellites.length === 0) {
        return;
    }

    const date = new Date();
    const gmst = satellite.gstime(date);
    
    satellites.forEach(sat => {
        try {
            const positionAndVelocity = satellite.propagate(sat.satrec, date);
            
            // dont update if invalid
            if (positionAndVelocity.position === false || positionAndVelocity.velocity === false) {
                return;
            }

            const position = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

            const lat = satellite.degreesLat(position.latitude);
            const lon = satellite.degreesLong(position.longitude);
            const alt = position.height / 6371; // km to earth radii

            const pos = latLongToVector3(lat, lon, 1 + alt);
            sat.mesh.position.copy(pos);

            sat.mesh.lookAt(camera.position);
        } catch (error) {
            console.warn('error updating satellite position:', error);
        }
    });
}

function latLongToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));

    return new THREE.Vector3(x, y, z);
}

function updateMoonPosition() {
    const moonOrbitRadius = 60.3;
    const time = Date.now() * 0.001;
    const moonOrbitPeriod = 27.3 * 24 * 60 * 60;
    const angle = (time % moonOrbitPeriod) / moonOrbitPeriod * Math.PI * 2;

    moon.position.x = Math.cos(angle) * moonOrbitRadius;
    moon.position.z = Math.sin(angle) * moonOrbitRadius;
    
    moon.position.y = Math.sin(angle) * moonOrbitRadius * Math.sin(5.14 * Math.PI / 180);

    moon.rotation.y = -angle;
}

function calculateSunPosition() {
    const now = new Date();
    const julianDate = (now.getTime() / 86400000) + 2440587.5;
    const centuries = (julianDate - 2451545) / 36525;
    
    // solar coords
    const meanLongitude = (280.46646 + centuries * (36000.76983 + centuries * 0.0003032)) % 360;
    const meanAnomaly = 357.52911 + centuries * (35999.05029 - 0.0001537 * centuries);
    
    const eclipticLongitude = meanLongitude + 1.914602 * Math.sin(meanAnomaly * Math.PI / 180) + 0.019993 * Math.sin(2 * meanAnomaly * Math.PI / 180);
    const obliquity = 23.439 - 0.0000004 * centuries;
    
    // to cartesian
    const x = Math.cos(eclipticLongitude * Math.PI / 180);
    const y = Math.cos(obliquity * Math.PI / 180) * Math.sin(eclipticLongitude * Math.PI / 180);
    const z = Math.sin(obliquity * Math.PI / 180) * Math.sin(eclipticLongitude * Math.PI / 180);
    
    return new THREE.Vector3(-x, z, -y).normalize().multiplyScalar(100);
}

function updateEarthRotation() {
    const now = new Date();
    const hoursUTC = now.getUTCHours();
    const minutesUTC = now.getUTCMinutes();
    const secondsUTC = now.getUTCSeconds();
    
    const totalSeconds = hoursUTC * 3600 + minutesUTC * 60 + secondsUTC;
    const rotationAngle = (totalSeconds / 86400) * Math.PI * 2;
    
    earth.rotation.y = rotationAngle;
}

function updateSunPosition() {
    const sunPosition = calculateSunPosition();
    const cameraRotation = new THREE.Quaternion();
    camera.getWorldQuaternion(cameraRotation);
    const rotatedSunPosition = sunPosition.applyQuaternion(cameraRotation.invert());
    directionalLight.position.copy(rotatedSunPosition);
}

function onDocumentMouseClick(event) {
    event.preventDefault();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(earth.children);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        if (clickedObject.callback) {
            clickedObject.callback();
        }
    }
}

function createSatellitePopup(data, position) {
    const existingPopup = document.getElementById('satellite-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.id = 'satellite-popup';
    const satellite = satellites.find(sat => sat.name === data.name);
    const type = satellite ? (data.description ? data.description : data.type) : 'unknown';
    popup.textContent = `${data.name} (${type.toUpperCase()})`;
    popup.style.position = 'absolute';
    popup.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    popup.style.color = 'white';
    popup.style.padding = '5px';
    popup.style.borderRadius = '3px';
    popup.style.fontSize = '16px';
    popup.style.pointerEvents = 'none';

    document.body.appendChild(popup);

    updatePopupPosition(popup, position);

    return popup;
}

function removeSatellitePopup(satellite) {
    if (satellite.popup) {
        satellite.popup.remove();
        satellite.popup = null;
    }
}

function updatePopupPosition(popup, position) {
    const vector = new THREE.Vector3();
    vector.setFromMatrixPosition(position.matrixWorld);
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

    popup.style.left = `${x}px`;
    popup.style.top = `${y - 30}px`;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateSatellitePositions();
    updateMoonPosition();
    
    updateEarthRotation();
    updateSunPosition();
    
    earth.material.uniforms.sunDirection.value.copy(directionalLight.position).normalize();
    cloudMesh.material.uniforms.sunDirection.value.copy(directionalLight.position).normalize();

    if (atmosphereMesh) {
        atmosphereMesh.quaternion.copy(earth.quaternion);
        atmosphereMesh.position.copy(earth.position);
    }

    if (cloudMesh) {
        cloudMesh.rotation.y += 0.0001;
    }
    
    satellites.forEach(sat => {
        if (sat.mesh.popup) {
            updatePopupPosition(sat.mesh.popup, sat.mesh);
        }
    });
    
    renderer.render(scene, camera);
}

init();