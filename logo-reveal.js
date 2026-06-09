// --- ADVANCED PARTICLE SYSTEM LOGIC --- //

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050508, 0.002);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

let targetCameraZ = 150;
let explosionCameraZ = 200;

function updateCameraZ() {
    if (window.innerWidth < 480) {
        targetCameraZ = 200;
        explosionCameraZ = 300;
    } else if (window.innerWidth < 768) {
        targetCameraZ = 320;
        explosionCameraZ = 380;
    } else {
        targetCameraZ = 120;
        explosionCameraZ = 200;
    }
    camera.position.z = targetCameraZ;
}
updateCameraZ();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Post-Processing (Bloom)
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 1.5; 
bloomPass.radius = 0.5;

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Resize handler
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    updateCameraZ();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// Global Particle Settings
const PARTICLES_PER_LETTER = 8000; 
const TOTAL_PARTICLES = PARTICLES_PER_LETTER * 6;
const letterSpacing = 22;
const wordWidth = letterSpacing * 5; 
const startX = -wordWidth / 2;

// Geometries & Materials
const particlesGeometry = new THREE.BufferGeometry();
const posArray = new Float32Array(TOTAL_PARTICLES * 3);
const colorsArray = new Float32Array(TOTAL_PARTICLES * 3);

// We will store the CURRENT position, the TARGET position, and a LERP SPEED for every particle.
const currentPositions = new Float32Array(TOTAL_PARTICLES * 3);
const targetPositions = new Float32Array(TOTAL_PARTICLES * 3);
const lerpSpeeds = new Float32Array(TOTAL_PARTICLES);

// Background Dust
const dustGeo = new THREE.BufferGeometry();
const dustCount = 2000;
const dustPos = new Float32Array(dustCount * 3);
for(let i=0; i<dustCount*3; i+=3) {
    dustPos[i] = (Math.random() - 0.5) * 400;
    dustPos[i+1] = (Math.random() - 0.5) * 400;
    dustPos[i+2] = (Math.random() - 0.5) * 400;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({ size: 0.3, color: 0x4444ff, transparent: true, opacity: 0.3 });
const dustMesh = new THREE.Points(dustGeo, dustMat);
scene.add(dustMesh);

// Gradient Color Helper
const colorBlue = new THREE.Color(0x007bff);
const colorPurple = new THREE.Color(0x8a2be2);

// Initialize Particles (Hidden randomly)
for(let i = 0; i < TOTAL_PARTICLES; i++) {
    const i3 = i * 3;
    currentPositions[i3] = (Math.random() - 0.5) * 500;
    currentPositions[i3+1] = (Math.random() - 0.5) * 500;
    currentPositions[i3+2] = (Math.random() - 0.5) * 500;
    
    targetPositions[i3] = currentPositions[i3];
    targetPositions[i3+1] = currentPositions[i3+1];
    targetPositions[i3+2] = currentPositions[i3+2];
    
    lerpSpeeds[i] = 0.02 + Math.random() * 0.05; // Randomize lerp speed for organic movement

    // Color based on letter group (0 to 5)
    const letterIndex = Math.floor(i / PARTICLES_PER_LETTER);
    const lerpFactor = letterIndex / 5;
    const pColor = new THREE.Color().copy(colorBlue).lerp(colorPurple, lerpFactor);
    
    colorsArray[i3] = pColor.r;
    colorsArray[i3+1] = pColor.g;
    colorsArray[i3+2] = pColor.b;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
});

const mainParticleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(mainParticleSystem);

// Targets Storage
const TargetStates = {
    Void: new Float32Array(TOTAL_PARTICLES * 3),
    Z_Center: new Float32Array(PARTICLES_PER_LETTER * 3),
    Q_Center: new Float32Array(PARTICLES_PER_LETTER * 3),
    Z_Graph: new Float32Array(PARTICLES_PER_LETTER * 3),
    Q_MagGlass: new Float32Array(PARTICLES_PER_LETTER * 3),
    Y_Constellation: new Float32Array(PARTICLES_PER_LETTER * 3),
    L_Rain: new Float32Array(PARTICLES_PER_LETTER * 3),
    A_Rocket: new Float32Array(PARTICLES_PER_LETTER * 3),
    R_Orbit: new Float32Array(PARTICLES_PER_LETTER * 3),
    Word_Z: new Float32Array(PARTICLES_PER_LETTER * 3),
    Word_Y: new Float32Array(PARTICLES_PER_LETTER * 3),
    Word_L: new Float32Array(PARTICLES_PER_LETTER * 3),
    Word_A: new Float32Array(PARTICLES_PER_LETTER * 3),
    Word_R: new Float32Array(PARTICLES_PER_LETTER * 3),
    Word_Q: new Float32Array(PARTICLES_PER_LETTER * 3),
};

// Populate Void state (random sphere)
for(let i=0; i<TOTAL_PARTICLES*3; i++) TargetStates.Void[i] = (Math.random() - 0.5) * 600;

// Helper to sample points evenly across the surface of a geometry using triangle interpolation
function sampleGeometry(geometry, count) {
    const pos = geometry.attributes.position.array;
    const index = geometry.index ? geometry.index.array : null;
    const triangles = [];
    
    // Extract triangles
    if (index) {
        for(let i=0; i<index.length; i+=3) {
            triangles.push([index[i], index[i+1], index[i+2]]);
        }
    } else {
        const vertexCount = pos.length / 3;
        for(let i=0; i<vertexCount; i+=3) {
            triangles.push([i, i+1, i+2]);
        }
    }

    const points = new Float32Array(count * 3);
    for ( let i = 0; i < count; i ++ ) {
        // Pick random triangle
        const t = triangles[Math.floor(Math.random() * triangles.length)];
        
        // Random barycentric coordinates for uniform distribution
        let r1 = Math.random();
        let r2 = Math.random();
        if (r1 + r2 > 1) {
            r1 = 1 - r1;
            r2 = 1 - r2;
        }
        const r3 = 1 - r1 - r2;

        const vA = t[0]*3, vB = t[1]*3, vC = t[2]*3;

        points[i*3] = pos[vA]*r1 + pos[vB]*r2 + pos[vC]*r3;
        points[i*3+1] = pos[vA+1]*r1 + pos[vB+1]*r2 + pos[vC+1]*r3;
        points[i*3+2] = pos[vA+2]*r1 + pos[vB+2]*r2 + pos[vC+2]*r3;
    }
    return points;
}

// Load Font and Build Targets (Using jsdelivr for safe CORS)
const loader = new THREE.FontLoader();
loader.load('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_bold.typeface.json', function (font) {
    buildTargets(font);
    startCinematicSequence();
}, undefined, function (err) {
    console.error("Error loading font:", err);
});

function createTextGeo(char) {
    const geo = new THREE.TextGeometry(char, {
        font: globalFont, size: 20, height: 4, curveSegments: 10,
        bevelEnabled: true, bevelThickness: 1, bevelSize: 0.5, bevelSegments: 3
    });
    geo.computeBoundingBox();
    const centerOffset = -0.5 * (geo.boundingBox.max.x - geo.boundingBox.min.x);
    geo.translate(centerOffset, 0, 0);
    return geo;
}

// Global ref for font
let globalFont;

function buildTargets(font) {
    globalFont = font;
    
    // --- 1. Word Targets (The Final ZYLARQ) ---
    const chars = ['Z', 'Y', 'L', 'A', 'R', 'Q'];
    const wordTargetArrays = [TargetStates.Word_Z, TargetStates.Word_Y, TargetStates.Word_L, TargetStates.Word_A, TargetStates.Word_R, TargetStates.Word_Q];
    
    chars.forEach((char, index) => {
        const geo = createTextGeo(char);
        const sampled = sampleGeometry(geo, PARTICLES_PER_LETTER);
        const xOffset = startX + (index * letterSpacing);
        
        for(let i=0; i<PARTICLES_PER_LETTER; i++) {
            wordTargetArrays[index][i*3] = sampled[i*3] + xOffset;
            wordTargetArrays[index][i*3+1] = sampled[i*3+1];
            wordTargetArrays[index][i*3+2] = sampled[i*3+2];
        }
    });

    // --- 2. Initial Z and Q at Center ---
    for(let i=0; i<PARTICLES_PER_LETTER*3; i+=3) {
        TargetStates.Z_Center[i] = TargetStates.Word_Z[i] - startX - 15; // Shift left of center
        TargetStates.Z_Center[i+1] = TargetStates.Word_Z[i+1];
        TargetStates.Z_Center[i+2] = TargetStates.Word_Z[i+2];

        TargetStates.Q_Center[i] = TargetStates.Word_Q[i] - (startX + 5*letterSpacing) + 15; // Shift right of center
        TargetStates.Q_Center[i+1] = TargetStates.Word_Q[i+1];
        TargetStates.Q_Center[i+2] = TargetStates.Word_Q[i+2];
    }

    // --- 3. Custom Morph Targets ---

    // Z -> Growth Graph
    for(let i=0; i<PARTICLES_PER_LETTER; i++) {
        // A simple upward zigzag
        const t = i / PARTICLES_PER_LETTER;
        const x = -10 + (t * 20);
        const y = -10 + (t * 20) + Math.sin(t * Math.PI * 4) * 5; 
        TargetStates.Z_Graph[i*3] = x - 25; // Move left
        TargetStates.Z_Graph[i*3+1] = y;
        TargetStates.Z_Graph[i*3+2] = (Math.random()-0.5)*2;
    }

    // Q -> Magnifying Glass
    const magRing = new THREE.TorusGeometry(8, 1.5, 16, 100);
    const magHandle = new THREE.CylinderGeometry(1, 1, 12, 16);
    magHandle.translate(8, -8, 0);
    magHandle.rotateZ(-Math.PI/4);
    
    // Merge roughly (we'll just sample both)
    const ringPts = sampleGeometry(magRing, PARTICLES_PER_LETTER/2);
    const handlePts = sampleGeometry(magHandle, PARTICLES_PER_LETTER/2);
    
    for(let i=0; i<PARTICLES_PER_LETTER/2; i++) {
        TargetStates.Q_MagGlass[i*3] = ringPts[i*3] + 25; // Move right
        TargetStates.Q_MagGlass[i*3+1] = ringPts[i*3+1];
        TargetStates.Q_MagGlass[i*3+2] = ringPts[i*3+2];
        
        const offset = (PARTICLES_PER_LETTER/2)*3;
        TargetStates.Q_MagGlass[offset + i*3] = handlePts[i*3] + 25;
        TargetStates.Q_MagGlass[offset + i*3+1] = handlePts[i*3+1];
        TargetStates.Q_MagGlass[offset + i*3+2] = handlePts[i*3+2];
    }

    // Y -> Constellation (Random scattered, then snaps)
    for(let i=0; i<PARTICLES_PER_LETTER*3; i++) {
        TargetStates.Y_Constellation[i] = TargetStates.Word_Y[i] + (Math.random() - 0.5) * 80;
    }

    // L -> Rain (Way up high)
    for(let i=0; i<PARTICLES_PER_LETTER; i++) {
        TargetStates.L_Rain[i*3] = TargetStates.Word_L[i*3];
        TargetStates.L_Rain[i*3+1] = TargetStates.Word_L[i*3+1] + 100 + Math.random()*50;
        TargetStates.L_Rain[i*3+2] = TargetStates.Word_L[i*3+2];
    }

    // A -> Rocket (At bottom)
    for(let i=0; i<PARTICLES_PER_LETTER; i++) {
        TargetStates.A_Rocket[i*3] = TargetStates.Word_A[i*3];
        TargetStates.A_Rocket[i*3+1] = TargetStates.Word_A[i*3+1] - 100;
        TargetStates.A_Rocket[i*3+2] = TargetStates.Word_A[i*3+2];
    }

    // R -> Orbit (Rings)
    for(let i=0; i<PARTICLES_PER_LETTER; i++) {
        const theta = Math.random() * Math.PI * 2;
        const radius = 15 + Math.random() * 5;
        TargetStates.R_Orbit[i*3] = TargetStates.Word_R[i*3] + Math.cos(theta) * radius;
        TargetStates.R_Orbit[i*3+1] = TargetStates.Word_R[i*3+1] + Math.sin(theta) * radius;
        TargetStates.R_Orbit[i*3+2] = (Math.random()-0.5) * 10;
    }
}

// Sequence Controller
const introAudio = new Audio('music/intro.mp3');
introAudio.volume = 0.6; // Set to a nice background pace volume

function setTargetForGroup(groupIndex, targetArray) {
    const offset = groupIndex * PARTICLES_PER_LETTER * 3;
    for(let i=0; i<PARTICLES_PER_LETTER*3; i++) {
        targetPositions[offset + i] = targetArray[i];
        // randomize lerp speed for organic flow
        lerpSpeeds[groupIndex * PARTICLES_PER_LETTER + Math.floor(i/3)] = 0.02 + Math.random() * 0.04; 
    }
}

let audioStarted = false;
    document.body.addEventListener('click', () => {
        if (!audioStarted) {
            introAudio.play().catch(e => {});
            audioStarted = true;
            const hint = document.getElementById('audio-hint');
            if (hint) hint.style.opacity = '0';
        }
    });

function startCinematicSequence() {
    // Attempt to play audio. Note: Browsers may block this without prior user interaction.
    introAudio.play().catch(e => console.log('Audio autoplay blocked by browser. Click anywhere first if testing locally.'));
    
    // 1. Z and Q appear in center from the void
    setTimeout(() => {
        setTargetForGroup(0, TargetStates.Z_Center);
        setTargetForGroup(5, TargetStates.Q_Center);
    }, 1000);

    // 2. Q transforms to Magnifying Glass, Z to Graph
    setTimeout(() => {
        setTargetForGroup(0, TargetStates.Z_Graph);
        setTargetForGroup(5, TargetStates.Q_MagGlass);
    }, 4000);

    // 3. Scanner Beam (approximated by Y, L, A, R forming from their abstract states)
    setTimeout(() => {
        // Prepare abstract states
        setTargetForGroup(1, TargetStates.Y_Constellation);
        setTargetForGroup(2, TargetStates.L_Rain);
        setTargetForGroup(3, TargetStates.A_Rocket);
        setTargetForGroup(4, TargetStates.R_Orbit);
    }, 6000);

    // 4. Letters resolve into shape one by one (The Scan passing)
    setTimeout(() => setTargetForGroup(1, TargetStates.Word_Y), 7000); // Y forms from constellation
    setTimeout(() => setTargetForGroup(2, TargetStates.Word_L), 8000); // L drops from code rain
    setTimeout(() => setTargetForGroup(3, TargetStates.Word_A), 9000); // A shoots up from rocket
    setTimeout(() => setTargetForGroup(4, TargetStates.Word_R), 10000); // R collapses from orbit

    // 5. The Climax (Explosion)
    setTimeout(() => {
        gsap.to(bloomPass, { strength: 3.0, duration: 1 });
        gsap.to(camera.position, { z: explosionCameraZ, duration: 2, ease: "power2.inOut" });
        
        // Blast all to void
        for(let i=0; i<6; i++) setTargetForGroup(i, TargetStates.Void);
        
        // Increase lerp speed drastically for explosion
        for(let i=0; i<TOTAL_PARTICLES; i++) lerpSpeeds[i] = 0.1 + Math.random()*0.2;
    }, 12000);

    // 6. The Reassembly (ZYLARQ)
    setTimeout(() => {
        setTargetForGroup(0, TargetStates.Word_Z);
        setTargetForGroup(1, TargetStates.Word_Y);
        setTargetForGroup(2, TargetStates.Word_L);
        setTargetForGroup(3, TargetStates.Word_A);
        setTargetForGroup(4, TargetStates.Word_R);
        setTargetForGroup(5, TargetStates.Word_Q);

        // Smooth settle
        for(let i=0; i<TOTAL_PARTICLES; i++) lerpSpeeds[i] = 0.05 + Math.random()*0.05;
        
        gsap.to(bloomPass, { strength: 1.5, duration: 2 });
        gsap.to(camera.position, { z: targetCameraZ, duration: 3, ease: "power2.out" });
        
        // Reveal Tagline
        gsap.to("#tagline", { opacity: 1, duration: 2, delay: 1 });

        // Fade out and Redirect to portfolio
        setTimeout(() => {
            const overlay = document.getElementById('fade-overlay');
            if (overlay) overlay.classList.add('active');
            
            // Fade out the music slowly
            gsap.to(introAudio, { volume: 0, duration: 2 });
            
            setTimeout(() => {
                introAudio.pause();
                window.location.href = "portfolio.html";
            }, 2000); // Wait 2s for the overlay to fully fade in
        }, 3000); // Wait 3 seconds after the tagline reveals before transitioning

    }, 13500);
}

// Render Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const elapsedTime = clock.getElapsedTime();

    // Rotate dust
    dustMesh.rotation.y = elapsedTime * 0.05;

    // Physics / Lerp for main particles
    const positions = particlesGeometry.attributes.position.array;
    
    for(let i = 0; i < TOTAL_PARTICLES; i++) {
        const i3 = i * 3;
        const speed = lerpSpeeds[i];
        
        // Lerp towards target
        positions[i3] += (targetPositions[i3] - positions[i3]) * speed;
        positions[i3+1] += (targetPositions[i3+1] - positions[i3+1]) * speed;
        positions[i3+2] += (targetPositions[i3+2] - positions[i3+2]) * speed;

        // Add slight noise/wobble for organic anti-gravity feel when near target
        if (Math.abs(targetPositions[i3] - positions[i3]) < 2) {
            positions[i3] += Math.sin(elapsedTime * 2 + i) * 0.05;
            positions[i3+1] += Math.cos(elapsedTime * 3 + i) * 0.05;
        }
    }
    
    particlesGeometry.attributes.position.needsUpdate = true;

    composer.render();
}

animate();


