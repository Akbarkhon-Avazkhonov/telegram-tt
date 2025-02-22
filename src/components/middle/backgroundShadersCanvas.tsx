import type { RefObject } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo,
  useRef,
} from '../../lib/teact/teact';

import type { ThemeKey } from '../../types';

import {
  fragmentShader,
  hexToVec3, loadShaders, shadersConfig, vertexShader,
} from './shaders/backgroundShaders';

import styles from './MiddleColumn.module.scss';

type OwnProps = {
  theme:ThemeKey;
  animateFnRef:RefObject<NoneToVoidFunction | undefined> ;
};
let keyShift = 0;

let targetColor1Pos: number[];
let targetColor2Pos: number[];
let targetColor3Pos: number[];
let targetColor4Pos: number[];
const keyPoints = [
  [0.265, 0.582],
  [0.176, 0.918],
  [1 - 0.585, 1 - 0.164],
  [0.644, 0.755],
  [1 - 0.265, 1 - 0.582],
  [1 - 0.176, 1 - 0.918],
  [0.585, 0.164],
  [1 - 0.644, 1 - 0.755],
];
const speed = 0.1;
let animating = false;

const BackgroundShaders = ({ theme, animateFnRef }:OwnProps) => {
  // eslint-disable-next-line no-null/no-null
  const shadersCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const colors = useMemo(() => ({
    color1: hexToVec3(shadersConfig[theme].colors.color1),
    color2: hexToVec3(shadersConfig[theme].colors.color2),
    color3: hexToVec3(shadersConfig[theme].colors.color3),
    color4: hexToVec3(shadersConfig[theme].colors.color4),
  }), [theme]);

  useEffect(() => {
    if (!shadersCanvasRef.current) {
      return;
    }

    const context = prepareWebGLContext({ canvas: shadersCanvasRef.current });
    if (!context) {
      return;
    }
    const { gl, program } = context;

    updateTargetColors();

    const color1Pos = [targetColor1Pos![0], targetColor1Pos![1]];
    const color2Pos = [targetColor2Pos![0], targetColor2Pos![1]];
    const color3Pos = [targetColor3Pos![0], targetColor3Pos![1]];
    const color4Pos = [targetColor4Pos![0], targetColor4Pos![1]];

    renderGradientCanvas(gl, program, colors, {
      color1Pos, color2Pos, color3Pos, color4Pos,
    });

    function animate() {
      animating = true;

      if (
        distance(color1Pos, targetColor1Pos) > 0.01
    || distance(color2Pos, targetColor2Pos) > 0.01
    || distance(color3Pos, targetColor3Pos) > 0.01
    || distance(color4Pos, targetColor4Pos) > 0.01
      ) {
        color1Pos[0] = color1Pos[0] * (1 - speed) + targetColor1Pos[0] * speed;
        color1Pos[1] = color1Pos[1] * (1 - speed) + targetColor1Pos[1] * speed;
        color2Pos[0] = color2Pos[0] * (1 - speed) + targetColor2Pos[0] * speed;
        color2Pos[1] = color2Pos[1] * (1 - speed) + targetColor2Pos[1] * speed;
        color3Pos[0] = color3Pos[0] * (1 - speed) + targetColor3Pos[0] * speed;
        color3Pos[1] = color3Pos[1] * (1 - speed) + targetColor3Pos[1] * speed;
        color4Pos[0] = color4Pos[0] * (1 - speed) + targetColor4Pos[0] * speed;
        color4Pos[1] = color4Pos[1] * (1 - speed) + targetColor4Pos[1] * speed;
        renderGradientCanvas(gl, program, colors, {
          color1Pos, color2Pos, color3Pos, color4Pos,
        });
        requestAnimationFrame(animate);
      } else {
        animating = false;
      }
    }

    function animateFn() {
      if (!animating) {
        updateTargetColors();
        requestAnimationFrame(animate);
      }
    }
    animateFnRef.current = animateFn;
  }, [animateFnRef, colors]);

  return (
    <canvas
      className={styles.chatBgCanvas}
      ref={shadersCanvasRef}
    />
  );
};

export default memo(BackgroundShaders);

function prepareWebGLContext({ canvas }:{ canvas:HTMLCanvasElement }):
{ gl: WebGLRenderingContext; program:WebGLProgram } | undefined {
  const gl = canvas.getContext('webgl');
  if (!gl) {
    return undefined;
  }
  const program = gl.createProgram()!;
  if (!program) {
    return undefined;
  }

  const shaders = loadShaders(gl, [vertexShader, fragmentShader]);
  for (const shader of shaders) {
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return undefined;
  }
  gl.useProgram(program);

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
  const positionBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1,
      -1,
      1,
      -1,
      -1,
      1,
      -1,
      1,
      1,
      -1,
      1,
      1,
    ]),
    gl.STATIC_DRAW,
  );

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(
    positionAttributeLocation,
    2,
    gl.FLOAT,
    false,
    0,
    0,
  );
  return { gl, program };
}

function distance(p1: number[], p2: number[]) {
  return Math.sqrt(
    (p1[1] - p2[1]) * (p1[1] - p2[1]),
  );
}
type ColorsPositions = {
  color1Pos:number[];
  color2Pos:number[];
  color3Pos:number[];
  color4Pos:number[];
};
  type HexColors = {
    color1: readonly [r: number, g: number, b: number];
    color2: readonly [r: number, g: number, b: number];
    color3: readonly [r: number, g: number, b: number];
    color4: readonly [r: number, g: number, b: number];
  };
function renderGradientCanvas(
  gl:WebGLRenderingContext,
  program:WebGLProgram,
  colors: HexColors,
  {
    color1Pos, color2Pos, color3Pos, color4Pos,
  }:ColorsPositions,
) {
  const resolutionLoc = gl.getUniformLocation(program, 'resolution');
  const color1Loc = gl.getUniformLocation(program, 'color1');
  const color2Loc = gl.getUniformLocation(program, 'color2');
  const color3Loc = gl.getUniformLocation(program, 'color3');
  const color4Loc = gl.getUniformLocation(program, 'color4');
  const color1PosLoc = gl.getUniformLocation(program, 'color1Pos');
  const color2PosLoc = gl.getUniformLocation(program, 'color2Pos');
  const color3PosLoc = gl.getUniformLocation(program, 'color3Pos');
  const color4PosLoc = gl.getUniformLocation(program, 'color4Pos');

  gl.uniform2fv(resolutionLoc, [gl.canvas.width, gl.canvas.height]);
  gl.uniform3fv(color1Loc, colors.color1);
  gl.uniform3fv(color2Loc, colors.color2);
  gl.uniform3fv(color3Loc, colors.color3);
  gl.uniform3fv(color4Loc, colors.color4);
  gl.uniform2fv(color1PosLoc, color1Pos);
  gl.uniform2fv(color2PosLoc, color2Pos);
  gl.uniform2fv(color3PosLoc, color3Pos);
  gl.uniform2fv(color4PosLoc, color4Pos);

  gl.drawArrays(
    gl.TRIANGLES,
    0,
    6,
  );
}

function updateTargetColors() {
  targetColor1Pos = keyPoints[keyShift % 8];
  targetColor2Pos = keyPoints[(keyShift + 2) % 8];
  targetColor3Pos = keyPoints[(keyShift + 4) % 8];
  targetColor4Pos = keyPoints[(keyShift + 6) % 8];
  keyShift = (keyShift + 1) % 8;
}
