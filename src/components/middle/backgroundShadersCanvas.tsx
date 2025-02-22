import type { RefObject } from '../../lib/teact/teact';
import React, { memo, useEffect, useMemo, useRef } from '../../lib/teact/teact';

import type { ThemeKey } from '../../types';

import {
  fragmentShader,
  hexToVec3,
  loadShaders,
  shadersConfig,
  vertexShader,
} from './shaders/backgroundShaders';

import styles from './MiddleColumn.module.scss';

type OwnProps = {
  theme: ThemeKey;
  animateFnRef: RefObject<NoneToVoidFunction | undefined>;
};

let positionCycle = 0;
let targetShade1Pos: number[];
let targetShade2Pos: number[];
let targetShade3Pos: number[];
let targetShade4Pos: number[];

const transitionPoints = [
  [0.265, 0.582],
  [0.176, 0.918],
  [1 - 0.585, 1 - 0.164],
  [0.644, 0.755],
  [1 - 0.265, 1 - 0.582],
  [1 - 0.176, 1 - 0.918],
  [0.585, 0.164],
  [1 - 0.644, 1 - 0.755],
];

const transitionSpeed = 0.1;
let isAnimating = false;
const colorOffset = 0.05; // Небольшое смещение для изменения оттенков

const GradientCanvas = ({ theme, animateFnRef }: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const shades = useMemo(() => ({
    shade1: hexToVec3(shadersConfig[theme].colors.color1).map(c => c + colorOffset) as [number, number, number],
    shade2: hexToVec3(shadersConfig[theme].colors.color2).map(c => c + colorOffset) as [number, number, number],
    shade3: hexToVec3(shadersConfig[theme].colors.color3).map(c => c + colorOffset) as [number, number, number],
    shade4: hexToVec3(shadersConfig[theme].colors.color4).map(c => c + colorOffset) as [number, number, number],
  }), [theme]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderContext = initializeWebGL({ canvas: canvasRef.current });
    if (!renderContext) return;

    const { gl, program } = renderContext;

    refreshTargetPositions();

    const shade1Pos = [targetShade1Pos![0], targetShade1Pos![1]];
    const shade2Pos = [targetShade2Pos![0], targetShade2Pos![1]];
    const shade3Pos = [targetShade3Pos![0], targetShade3Pos![1]];
    const shade4Pos = [targetShade4Pos![0], targetShade4Pos![1]];

    drawGradient(gl, program, shades, {
      shade1Pos,
      shade2Pos,
      shade3Pos,
      shade4Pos,
    });

    function transition() {
      isAnimating = true;

      if (
        computeDistance(shade1Pos, targetShade1Pos) > 0.01 ||
        computeDistance(shade2Pos, targetShade2Pos) > 0.01 ||
        computeDistance(shade3Pos, targetShade3Pos) > 0.01 ||
        computeDistance(shade4Pos, targetShade4Pos) > 0.01
      ) {
        shade1Pos[0] = shade1Pos[0] * (1 - transitionSpeed) + targetShade1Pos[0] * transitionSpeed;
        shade1Pos[1] = shade1Pos[1] * (1 - transitionSpeed) + targetShade1Pos[1] * transitionSpeed;
        shade2Pos[0] = shade2Pos[0] * (1 - transitionSpeed) + targetShade2Pos[0] * transitionSpeed;
        shade2Pos[1] = shade2Pos[1] * (1 - transitionSpeed) + targetShade2Pos[1] * transitionSpeed;
        shade3Pos[0] = shade3Pos[0] * (1 - transitionSpeed) + targetShade3Pos[0] * transitionSpeed;
        shade3Pos[1] = shade3Pos[1] * (1 - transitionSpeed) + targetShade3Pos[1] * transitionSpeed;
        shade4Pos[0] = shade4Pos[0] * (1 - transitionSpeed) + targetShade4Pos[0] * transitionSpeed;
        shade4Pos[1] = shade4Pos[1] * (1 - transitionSpeed) + targetShade4Pos[1] * transitionSpeed;

        drawGradient(gl, program, shades, {
          shade1Pos,
          shade2Pos,
          shade3Pos,
          shade4Pos,
        });

        requestAnimationFrame(transition);
      } else {
        isAnimating = false;
      }
    }

    function triggerTransition() {
      if (!isAnimating) {
        refreshTargetPositions();
        requestAnimationFrame(transition);
      }
    }

    if (animateFnRef) {
      animateFnRef.current = triggerTransition;
    }
  }, [animateFnRef, shades]);

  return <canvas className={styles.chatBgCanvas} ref={canvasRef} />;
};

export default memo(GradientCanvas);

function initializeWebGL({ canvas }: { canvas: HTMLCanvasElement }): 
  { gl: WebGLRenderingContext; program: WebGLProgram } | undefined {
  const gl = canvas.getContext('webgl');
  if (!gl) return undefined;

  const program = gl.createProgram()!;
  if (!program) return undefined;

  const shaders = loadShaders(gl, [vertexShader, fragmentShader]);
  for (const shader of shaders) {
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;

  gl.useProgram(program);

  const positionSlot = gl.getAttribLocation(program, 'a_position');
  const buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.enableVertexAttribArray(positionSlot);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(positionSlot, 2, gl.FLOAT, false, 0, 0);

  return { gl, program };
}

function computeDistance(pointA: number[], pointB: number[]): number {
  return Math.sqrt((pointA[1] - pointB[1]) * (pointA[1] - pointB[1]));
}

type ShadePositions = {
  shade1Pos: number[];
  shade2Pos: number[];
  shade3Pos: number[];
  shade4Pos: number[];
};

type ShadeColors = {
  shade1: readonly [r: number, g: number, b: number];
  shade2: readonly [r: number, g: number, b: number];
  shade3: readonly [r: number, g: number, b: number];
  shade4: readonly [r: number, g: number, b: number];
};

function drawGradient(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  shades: ShadeColors,
  { shade1Pos, shade2Pos, shade3Pos, shade4Pos }: ShadePositions
) {
  const resolutionSlot = gl.getUniformLocation(program, 'resolution');
  const shade1Slot = gl.getUniformLocation(program, 'color1');
  const shade2Slot = gl.getUniformLocation(program, 'color2');
  const shade3Slot = gl.getUniformLocation(program, 'color3');
  const shade4Slot = gl.getUniformLocation(program, 'color4');
  const shade1PosSlot = gl.getUniformLocation(program, 'color1Pos');
  const shade2PosSlot = gl.getUniformLocation(program, 'color2Pos');
  const shade3PosSlot = gl.getUniformLocation(program, 'color3Pos');
  const shade4PosSlot = gl.getUniformLocation(program, 'color4Pos');

  gl.uniform2fv(resolutionSlot, [gl.canvas.width, gl.canvas.height]);
  gl.uniform3fv(shade1Slot, shades.shade1);
  gl.uniform3fv(shade2Slot, shades.shade2);
  gl.uniform3fv(shade3Slot, shades.shade3);
  gl.uniform3fv(shade4Slot, shades.shade4);
  gl.uniform2fv(shade1PosSlot, shade1Pos);
  gl.uniform2fv(shade2PosSlot, shade2Pos);
  gl.uniform2fv(shade3PosSlot, shade3Pos);
  gl.uniform2fv(shade4PosSlot, shade4Pos);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function refreshTargetPositions() {
  targetShade1Pos = transitionPoints[positionCycle % 8];
  targetShade2Pos = transitionPoints[(positionCycle + 2) % 8];
  targetShade3Pos = transitionPoints[(positionCycle + 4) % 8];
  targetShade4Pos = transitionPoints[(positionCycle + 6) % 8];
  positionCycle = (positionCycle + 1) % 8;
}