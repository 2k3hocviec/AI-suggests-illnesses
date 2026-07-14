'use client';

import { useEffect, useRef, useState } from 'react';
import type { Material, Texture } from 'three';
import styles from './AiRobot3D.module.css';

export function AiRobot3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const updateDesktopState = () => setIsDesktop(mediaQuery.matches);

    updateDesktopState();
    mediaQuery.addEventListener('change', updateDesktopState);

    return () => {
      mediaQuery.removeEventListener('change', updateDesktopState);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    async function initRobot() {
      const THREE = await import('three');
      const { OrbitControls } = await import(
        'three/examples/jsm/controls/OrbitControls.js'
      );

      if (!isMounted || !mountRef.current) {
        return;
      }

      const mount = mountRef.current;
      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 1.55, 7);
      const initialCameraPosition = camera.position.clone();
      const initialControlsTarget = new THREE.Vector3(0, 1.3, 0);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      mount.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.target.copy(initialControlsTarget);
      controls.minPolarAngle = Math.PI * 0.25;
      controls.maxPolarAngle = Math.PI * 0.82;
      controls.saveState();

      const hemi = new THREE.HemisphereLight(0xffffff, 0xb7aef0, 0.9);
      scene.add(hemi);

      const key = new THREE.DirectionalLight(0xffffff, 1.0);
      key.position.set(3, 5, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xb7aef0, 0.4);
      fill.position.set(-4, 2, -3);
      scene.add(fill);

      const robot = new THREE.Group();
      scene.add(robot);

      function roundedBox(
        width: number,
        height: number,
        depth: number,
        radius: number,
        material: Material,
      ) {
        const shape = new THREE.Shape();
        const x = -width / 2;
        const y = -height / 2;
        shape.moveTo(x, y + radius);
        shape.lineTo(x, y + height - radius);
        shape.quadraticCurveTo(x, y + height, x + radius, y + height);
        shape.lineTo(x + width - radius, y + height);
        shape.quadraticCurveTo(
          x + width,
          y + height,
          x + width,
          y + height - radius,
        );
        shape.lineTo(x + width, y + radius);
        shape.quadraticCurveTo(x + width, y, x + width - radius, y);
        shape.lineTo(x + radius, y);
        shape.quadraticCurveTo(x, y, x, y + radius);

        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelSize: 0.04,
          bevelThickness: 0.04,
          bevelSegments: 4,
          curveSegments: 12,
        });
        geometry.center();

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      }

      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x1467bd,
        roughness: 0.5,
        metalness: 0.05,
      });
      const armMat = new THREE.MeshStandardMaterial({
        color: 0x0f5ba8,
        roughness: 0.5,
      });
      const handMat = new THREE.MeshStandardMaterial({
        color: 0x7eb7f2,
        roughness: 0.5,
      });
      const footMat = new THREE.MeshStandardMaterial({
        color: 0x073f87,
        roughness: 0.55,
      });
      const capeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.72,
        side: THREE.DoubleSide,
      });
      const crossMat = new THREE.MeshStandardMaterial({
        color: 0xe84d5b,
        roughness: 0.45,
      });
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xf5f9ff,
        roughness: 0.4,
      });
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x073f87,
        roughness: 0.4,
      });
      const eyeWhiteMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
      });
      const eyePupilMat = new THREE.MeshStandardMaterial({
        color: 0x0b2f63,
        roughness: 0.3,
      });
      const cheekMat = new THREE.MeshStandardMaterial({
        color: 0xff9fbf,
        roughness: 0.6,
        transparent: true,
        opacity: 0.55,
      });
      const antennaMat = new THREE.MeshStandardMaterial({
        color: 0xffc94a,
        roughness: 0.3,
        emissive: 0xffc94a,
        emissiveIntensity: 0.3,
      });

      const body = roundedBox(1.7, 1.3, 1.0, 0.35, bodyMat);
      body.position.y = 1.0;
      robot.add(body);

      function makeCape() {
        const cape = new THREE.Group();
        cape.position.set(0, 1.02, -0.64);

        const shape = new THREE.Shape();
        shape.moveTo(-0.92, 0.55);
        shape.quadraticCurveTo(0, 0.78, 0.92, 0.55);
        shape.lineTo(1.18, -0.82);
        shape.quadraticCurveTo(0, -1.05, -1.18, -0.82);
        shape.lineTo(-0.92, 0.55);

        const cloth = new THREE.Mesh(new THREE.ShapeGeometry(shape), capeMat);
        cloth.castShadow = true;
        cloth.receiveShadow = true;
        cape.add(cloth);

        const badge = new THREE.Group();
        badge.position.set(0, -0.12, -0.035);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.24, 32), capeMat);
        badge.add(disc);
        badge.add(
          new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.3, 0.025), crossMat),
          new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.075, 0.025), crossMat),
        );
        cape.add(badge);

        return cape;
      }

      const cape = makeCape();
      robot.add(cape);

      function roundRect(
        context: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
      ) {
        context.beginPath();
        context.moveTo(x + radius, y);
        context.lineTo(x + width - radius, y);
        context.quadraticCurveTo(x + width, y, x + width, y + radius);
        context.lineTo(x + width, y + height - radius);
        context.quadraticCurveTo(
          x + width,
          y + height,
          x + width - radius,
          y + height,
        );
        context.lineTo(x + radius, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
      }

      function makeMedicalLogo() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');

        if (!context) {
          return new THREE.Group();
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#FFFFFF';
        context.strokeStyle = '#36B8B3';
        context.lineWidth = 16;
        roundRect(context, 42, 42, 428, 428, 88);
        context.fill();
        context.stroke();

        context.fillStyle = '#E84D5B';
        context.fillRect(228, 112, 56, 164);
        context.fillRect(174, 166, 164, 56);

        context.fillStyle = '#073F87';
        context.font = 'bold 92px Segoe UI, Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('AI', 256, 360);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
        });
        const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), material);
        logo.position.set(0, -0.08, 0.62);
        return logo;
      }

      body.add(makeMedicalLogo());

      function makeArm(sideSign: -1 | 1) {
        const arm = new THREE.Group();
        arm.position.set(sideSign * 0.84, 1.24, 0);
        arm.userData.baseRotation = -sideSign * -0.5;
        arm.rotation.z = arm.userData.baseRotation;

        const shoulder = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 18, 18),
          armMat,
        );
        shoulder.scale.set(0.9, 1, 0.9);
        shoulder.castShadow = true;
        shoulder.receiveShadow = true;
        arm.add(shoulder);

        const upper = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.16, 0.55, 4, 12),
          armMat,
        );
        upper.position.set(sideSign * 0.06, -0.34, 0);
        upper.rotation.z = sideSign * 0.08;
        upper.castShadow = true;
        upper.receiveShadow = true;
        arm.add(upper);

        const hand = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 16, 16),
          handMat,
        );
        hand.position.set(sideSign * 0.1, -0.68, 0);
        hand.castShadow = true;
        hand.receiveShadow = true;
        arm.add(hand);

        return arm;
      }

      const armL = makeArm(-1);
      const armR = makeArm(1);
      robot.add(armL, armR);

      function makeLeg(sideSign: -1 | 1) {
        const leg = new THREE.Group();
        const lower = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.18, 0.45, 4, 12),
          armMat,
        );
        lower.position.set(sideSign * 0.48, 0.18, 0);
        lower.castShadow = true;
        lower.receiveShadow = true;
        leg.add(lower);

        const foot = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 18, 18),
          footMat,
        );
        foot.scale.set(1.25, 0.45, 1.65);
        foot.position.set(sideSign * 0.48, -0.14, 0.1);
        foot.castShadow = true;
        foot.receiveShadow = true;
        leg.add(foot);

        return leg;
      }

      const legL = makeLeg(-1);
      const legR = makeLeg(1);
      robot.add(legL, legR);

      const headGroup = new THREE.Group();
      headGroup.position.y = 2.15;
      robot.add(headGroup);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 32), headMat);
      head.castShadow = true;
      head.receiveShadow = true;
      headGroup.add(head);

      const screen = roundedBox(1.35, 0.85, 0.15, 0.22, screenMat);
      screen.position.set(0, 0.02, 0.85);
      headGroup.add(screen);

      function makeEye(x: number) {
        const eye = new THREE.Group();
        eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 20), eyeWhiteMat));
        const pupil = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 16, 16),
          eyePupilMat,
        );
        pupil.position.z = 0.09;
        eye.add(pupil);
        eye.position.set(x, 0.03, 0.98);
        return eye;
      }

      const eyeL = makeEye(-0.32);
      const eyeR = makeEye(0.32);
      headGroup.add(eyeL, eyeR);
      const pupilL = eyeL.children[1];
      const pupilR = eyeR.children[1];

      function setEyeGaze(normalizedX: number, normalizedY: number) {
        const gazeX = THREE.MathUtils.clamp(normalizedX, -1, 1) * 0.045;
        const gazeY = THREE.MathUtils.clamp(normalizedY, -1, 1) * 0.035;

        pupilL.position.set(gazeX, gazeY, 0.09);
        pupilR.position.set(gazeX, gazeY, 0.09);
      }

      function resetViewToInitialPosition() {
        controls.reset();
        camera.position.copy(initialCameraPosition);
        controls.target.copy(initialControlsTarget);
        controls.update();
      }

      let pointerStart: { x: number; y: number } | null = null;

      function handlePointerDown(event: PointerEvent) {
        pointerStart = {
          x: event.clientX,
          y: event.clientY,
        };
      }

      function handlePointerUp(event: PointerEvent) {
        if (!pointerStart) {
          return;
        }

        const movement = Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y,
        );
        pointerStart = null;

        if (movement > 6) {
          return;
        }

        const rect = renderer.domElement.getBoundingClientRect();
        const canvasCenterX = rect.left + rect.width / 2;
        const canvasCenterY = rect.top + rect.height / 2;
        const normalizedX = (event.clientX - canvasCenterX) / (rect.width / 2);
        const normalizedY = -(event.clientY - canvasCenterY) / (rect.height / 2);

        resetViewToInitialPosition();
        setEyeGaze(normalizedX, normalizedY);
      }

      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('pointerup', handlePointerUp);

      const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), cheekMat);
      cheekL.scale.set(1, 0.7, 0.3);
      cheekL.position.set(-0.62, -0.18, 0.72);
      headGroup.add(cheekL);

      const cheekR = cheekL.clone();
      cheekR.position.x = 0.62;
      headGroup.add(cheekR);

      const antennaStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8),
        armMat,
      );
      antennaStem.position.set(0, 1.1, 0);
      headGroup.add(antennaStem);

      const antennaTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 16),
        antennaMat,
      );
      antennaTip.position.set(0, 1.3, 0);
      headGroup.add(antennaTip);

      function resize() {
        const width = Math.max(1, mount.clientWidth);
        const height = Math.max(1, mount.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
      resize();

      let animationFrame = 0;
      let time = 0;

      function animate() {
        animationFrame = requestAnimationFrame(animate);
        time += 0.04;
        robot.position.y = Math.sin(time) * 0.06;
        headGroup.rotation.z = Math.sin(time * 0.8) * 0.03;
        armL.rotation.z = armL.userData.baseRotation + Math.sin(time * 1.3) * 0.08;
        armR.rotation.z = armR.userData.baseRotation - Math.sin(time * 1.3) * 0.08;
        cape.position.z = -0.72 - Math.max(0, Math.sin(time * 1.15)) * 0.03;
        cape.rotation.x = 0.18 + Math.sin(time * 1.15) * 0.025;
        cape.rotation.z = Math.sin(time * 0.9) * 0.025;
        legL.rotation.z = -Math.sin(time * 1.1) * 0.04;
        legR.rotation.z = Math.sin(time * 1.1) * 0.04;

        const blink = Math.max(0, Math.sin(time * 1.7));
        const eyeScale = blink > 0.96 ? 0.1 : 1;
        eyeL.scale.y = eyeScale;
        eyeR.scale.y = eyeScale;

        controls.update();
        renderer.render(scene, camera);
      }

      animate();

      cleanup = () => {
        cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        document.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('pointerup', handlePointerUp);
        controls.dispose();
        renderer.dispose();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.forEach((material) => {
              const maybeTextured = material as Material & {
                map?: Texture;
              };
              maybeTextured.map?.dispose();
              material.dispose();
            });
          }
        });
        renderer.domElement.remove();
      };
    }

    void initRobot();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [isDesktop]);

  if (!isDesktop) {
    return null;
  }

  return (
    <div className={styles.robotShell} aria-hidden="true">
      <div ref={mountRef} className={styles.robotStage}>
        <div className={styles.robotHint}>Kéo để xoay</div>
      </div>
    </div>
  );
}
