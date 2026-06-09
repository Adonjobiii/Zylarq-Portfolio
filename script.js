// --- HTML DOM Setup ---
const rig = document.getElementById('camera-rig');
const hudDepth = document.getElementById('z-distance');
const planetNodes = document.querySelectorAll('.planet-node');

let currentZ = 0;
const scrollFactor = 2; 
const maxZ = 40000;

// Apply initial transforms so they don't overlap if Three.js crashes!
planetNodes.forEach(node => {
    const nodeZ = parseInt(node.getAttribute('data-z'));
    node.style.transform = `translateZ(${nodeZ}px)`;
});

let threeJsEnabled = false;

function updateUniverseHTML() {
    if (currentZ < 0) currentZ = 0;
    if (currentZ > maxZ) currentZ = maxZ;

    rig.style.transform = `translateZ(${currentZ}px)`;
    if(hudDepth) hudDepth.innerText = `DEPTH: ${Math.floor(currentZ).toString().padStart(5, '0')} Z`;

    planetNodes.forEach(node => {
        const nodeZ = parseInt(node.getAttribute('data-z'));
        const distance = Math.abs(currentZ + nodeZ); 
        const content = node.querySelector('.node-content');
        if(!content) return;
        
        if (distance < 2000) {
            const opacity = Math.max(0, 1 - (distance / 2000));
            content.style.opacity = opacity;
            content.style.visibility = opacity > 0.05 ? 'visible' : 'hidden';
            node.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
        } else {
            content.style.opacity = 0;
            content.style.visibility = 'hidden';
            node.style.pointerEvents = 'none';
        }
    });
}

window.addEventListener('scroll', () => {
    currentZ = window.scrollY * scrollFactor;
    updateUniverseHTML();
});
updateUniverseHTML();

// --- Pure Three.js Cosmic Background Setup ---
let scene, camera, renderer, particleTexture, stars, dnaGeometry, posArray, targetArray, originalPositions, dnaMaterial, dnaMesh, energyHighway1, energyHighway2, globeGroup;
let explosionTriggered = false;
let collapseFactor = 1;
const particleCount = 8000;

try {
    if (typeof THREE === 'undefined') {
        console.warn("Three.js not loaded. Falling back to HTML-only 3D.");
    } else {
        threeJsEnabled = true;
        const canvasContainer = document.getElementById('canvas-container');
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000510, 0.0003); // Deep space fog

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 40000);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        if(canvasContainer) canvasContainer.appendChild(renderer.domElement);

        // Create a glowing circular texture programmatically
        function createGlowTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.5, 'rgba(0, 140, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(canvas);
        }
        particleTexture = createGlowTexture();

        // --- 1. Universal Starfield ---
        const starGeo = new THREE.BufferGeometry();
        const starCount = 30000;
        const starPos = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);

        const colorWhite = new THREE.Color(0xffffff);
        const colorBlue = new THREE.Color(0x008cff);
        const colorPurple = new THREE.Color(0x8711c1);

        for(let i=0; i<starCount * 3; i+=3) {
            starPos[i] = (Math.random() - 0.5) * 6000;
            starPos[i+1] = (Math.random() - 0.5) * 6000;
            starPos[i+2] = Math.random() * 2000 - Math.random() * 40000;

            let rand = Math.random();
            let starColor;
            if (rand > 0.8) starColor = colorBlue;
            else if (rand > 0.6) starColor = colorPurple;
            else starColor = colorWhite;

            starColors[i] = starColor.r * 0.5;
            starColors[i+1] = starColor.g * 0.5;
            starColors[i+2] = starColor.b * 0.5;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

        const starMat = new THREE.PointsMaterial({
            size: 15,
            map: particleTexture,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        stars = new THREE.Points(starGeo, starMat);
        scene.add(stars);

        // --- 2. The Original DNA Sequence ---
        dnaGeometry = new THREE.BufferGeometry();
        posArray = new Float32Array(particleCount * 3);
        targetArray = new Float32Array(particleCount * 3);
        const colorsArray = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i+=3) {
            posArray[i] = (Math.random() - 0.5) * 4000;
            posArray[i+1] = (Math.random() - 0.5) * 4000;
            posArray[i+2] = -1000 - Math.random() * 9000;

            const strand = Math.random() > 0.5 ? 0 : 1;
            const isRung = Math.random() > 0.8;
            const zPos = posArray[i+2];
            const angle = zPos * 0.005; 
            let xTarget, yTarget;
            const radius = 300 + Math.random() * 50;

            if (isRung) {
                const r = (Math.random() - 0.5) * radius * 2;
                xTarget = Math.cos(angle) * r;
                yTarget = Math.sin(angle) * r;
            } else {
                const offset = strand === 0 ? 0 : Math.PI; 
                xTarget = Math.cos(angle + offset) * radius;
                yTarget = Math.sin(angle + offset) * radius;
                xTarget += (Math.random() - 0.5) * 20;
                yTarget += (Math.random() - 0.5) * 20;
            }
            targetArray[i] = xTarget;
            targetArray[i+1] = yTarget;
            targetArray[i+2] = zPos;

            const mixedColor = colorBlue.clone().lerp(colorPurple, Math.random());
            colorsArray[i] = mixedColor.r;
            colorsArray[i+1] = mixedColor.g;
            colorsArray[i+2] = mixedColor.b;
        }

        dnaGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        originalPositions = new Float32Array(posArray);
        dnaGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

        dnaMaterial = new THREE.PointsMaterial({ 
            size: 4, 
            map: particleTexture,
            vertexColors: true, 
            transparent: true, 
            opacity: 0.5, 
            depthWrite: false,
            blending: THREE.AdditiveBlending 
        });
        dnaMesh = new THREE.Points(dnaGeometry, dnaMaterial);
        scene.add(dnaMesh);

        // --- 3. Quantum Energy Highways ---
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x008cff, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending });
        const linePoints = [];
        for(let z=0; z>=-40000; z-=100) {
            linePoints.push(new THREE.Vector3(Math.sin(z * 0.0005) * 400, Math.cos(z * 0.0005) * 400, z));
        }
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        energyHighway1 = new THREE.Line(lineGeometry, lineMaterial);
        energyHighway2 = new THREE.Line(lineGeometry, lineMaterial);
        energyHighway2.rotation.z = Math.PI;
        scene.add(energyHighway1);
        scene.add(energyHighway2);

        // --- 4. Network Globe ---
        globeGroup = new THREE.Group();
        globeGroup.position.set(0, 0, -31500);

        const globeRadius = 600;
        const globePointsGeo = new THREE.BufferGeometry();
        const globePointCount = 200;
        const globePositions = new Float32Array(globePointCount * 3);

        for(let i=0; i<globePointCount; i++) {
            const phi = Math.acos(-1 + (2 * i) / globePointCount);
            const theta = Math.sqrt(globePointCount * Math.PI) * phi;
            globePositions[i*3] = globeRadius * Math.cos(theta) * Math.sin(phi);
            globePositions[i*3+1] = globeRadius * Math.sin(theta) * Math.sin(phi);
            globePositions[i*3+2] = globeRadius * Math.cos(phi);
        }
        globePointsGeo.setAttribute('position', new THREE.BufferAttribute(globePositions, 3));

        const globePointsMat = new THREE.PointsMaterial({ 
            color: 0x008cff, 
            size: 40, 
            map: particleTexture,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending 
        });
        const globePointsMesh = new THREE.Points(globePointsGeo, globePointsMat);
        globeGroup.add(globePointsMesh);

        const globeLinesGeo = new THREE.BufferGeometry();
        const globeLinePositions = [];
        for(let i=0; i<globePointCount; i++) {
            for(let j=i+1; j<globePointCount; j++) {
                let ix = globePositions[i*3], iy = globePositions[i*3+1], iz = globePositions[i*3+2];
                let jx = globePositions[j*3], jy = globePositions[j*3+1], jz = globePositions[j*3+2];
                let dist = Math.sqrt(Math.pow(ix-jx,2) + Math.pow(iy-jy,2) + Math.pow(iz-jz,2));
                if(dist < 200) {
                    globeLinePositions.push(ix, iy, iz, jx, jy, jz);
                }
            }
        }
        globeLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(globeLinePositions, 3));
        const globeLinesMat = new THREE.LineBasicMaterial({ color: 0x8711c1, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
        const globeLinesMesh = new THREE.LineSegments(globeLinesGeo, globeLinesMat);
        globeGroup.add(globeLinesMesh);

        const innerGlobeGeo = new THREE.SphereGeometry(globeRadius - 10, 32, 32);
        const innerGlobeMat = new THREE.MeshBasicMaterial({ color: 0x008cff, transparent: true, opacity: 0.05, wireframe: true, blending: THREE.AdditiveBlending });
        const innerGlobeMesh = new THREE.Mesh(innerGlobeGeo, innerGlobeMat);
        globeGroup.add(innerGlobeMesh);

        scene.add(globeGroup);
        
        window.addEventListener('resize', () => {
            if(!camera || !renderer) return;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animateThree();
    }
} catch (e) {
    console.error("Three.js setup failed:", e);
}

// Attach ThreeJS update to scroll listener
window.addEventListener('scroll', () => {
    if (threeJsEnabled && camera) {
        camera.position.z = -currentZ;
        
        // DNA Assembly Logic
        let assemblyRatio = Math.min(Math.max(currentZ / 7500, 0), 1);
        if (!explosionTriggered && dnaMesh) {
            const positions = dnaMesh.geometry.attributes.position.array;
            for (let i = 0; i < particleCount * 3; i+=3) {
                positions[i] = originalPositions[i] + (targetArray[i] - originalPositions[i]) * Math.pow(assemblyRatio, 2);
                positions[i+1] = originalPositions[i+1] + (targetArray[i+1] - originalPositions[i+1]) * Math.pow(assemblyRatio, 2);
            }
            dnaMesh.geometry.attributes.position.needsUpdate = true;
        }

        if (currentZ > 8000 && !explosionTriggered) {
            explosionTriggered = true;
        } else if (currentZ < 7500 && explosionTriggered && dnaMesh) {
            explosionTriggered = false;
            collapseFactor = 1;
            dnaMesh.scale.set(1,1,1);
        }
    }
});

function animateThree() {
    if (!threeJsEnabled) return;
    requestAnimationFrame(animateThree);
    
    // Slow rotations
    if(dnaMesh) dnaMesh.rotation.z += 0.001;
    if(stars) stars.rotation.z -= 0.0005;

    if(globeGroup) {
        globeGroup.rotation.y += 0.002;
        globeGroup.rotation.x += 0.001;
    }

    if(energyHighway1) energyHighway1.rotation.z += 0.002;
    if(energyHighway2) energyHighway2.rotation.z += 0.002;

    // DNA Implosion
    if (explosionTriggered && collapseFactor > 0.01 && dnaMesh) {
        collapseFactor *= 0.90; 
        dnaMesh.scale.x = collapseFactor;
        dnaMesh.scale.y = collapseFactor;
    }

    if(renderer && scene && camera) renderer.render(scene, camera);
}

// Tech Stack Shuttle Toggle Logic
function openTechStack(iconElement) {
    const panel = iconElement.nextElementSibling;
    document.querySelectorAll('.tech-stack-panel.active').forEach(p => {
        p.classList.remove('active');
        p.previousElementSibling.classList.remove('hidden');
    });
    iconElement.classList.add('hidden');
    panel.classList.add('active');
}

function closeTechStack(closeBtnElement) {
    const panel = closeBtnElement.parentElement;
    const shuttle = panel.previousElementSibling;
    panel.classList.remove('active');
    shuttle.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.shuttle-container')) {
        document.querySelectorAll('.tech-stack-panel.active').forEach(p => {
            p.classList.remove('active');
            p.previousElementSibling.classList.remove('hidden');
        });
    }
});

// Modal Logic
function openWebsitesModal() {
    const modal = document.getElementById('project-modal');
    if(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    }
}
function closeProjectModal() {
    const modal = document.getElementById('project-modal');
    if(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}
function openSoftwaresModal() {
    const modal = document.getElementById('softwares-modal');
    if(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}
function closeSoftwaresModal() {
    const modal = document.getElementById('softwares-modal');
    if(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}
function openPersonalizedModal() {
    const modal = document.getElementById('personalized-modal');
    if(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}
function closePersonalizedModal() {
    const modal = document.getElementById('personalized-modal');
    if(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}
function openContactModal() {
    const modal = document.getElementById('contact-modal');
    if(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}
function closeContactModal() {
    const modal = document.getElementById('contact-modal');
    if(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}
function openStartProjectModal() {
    const modal = document.getElementById('start-project-modal');
    if(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}
function closeStartProjectModal() {
    const modal = document.getElementById('start-project-modal');
    if(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}
