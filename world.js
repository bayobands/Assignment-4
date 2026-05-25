// world.js — CSE 160 Assignment 4: Phong Lighting
// Bayo Bandele — UC Santa Cruz
// Builds on A3 world with: normals, Phong shading, point light,
// spotlight, normal visualization, OBJ loading, on/off toggles.

// ============================================================
// SHADERS
// ============================================================
const VSHADER = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;

  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  uniform mat4 u_NormalMatrix;

  varying vec2  v_UV;
  varying vec3  v_Normal;
  varying vec3  v_WorldPos;

  void main() {
    vec4 worldPos4  = u_ModelMatrix * a_Position;
    gl_Position     = u_ProjectionMatrix * u_ViewMatrix * worldPos4;
    v_UV            = a_UV;
    v_WorldPos      = worldPos4.xyz;
    v_Normal        = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 0.0)));
  }
`;

const FSHADER = `
  precision mediump float;

  varying vec2  v_UV;
  varying vec3  v_Normal;
  varying vec3  v_WorldPos;

  uniform vec4  u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform int   u_whichTexture;

  // Lighting toggles
  uniform bool  u_LightOn;
  uniform bool  u_SpotOn;

  // Point light
  uniform vec3  u_LightPos;
  uniform vec3  u_LightColor;

  // Spotlight
  uniform vec3  u_SpotPos;
  uniform vec3  u_SpotDir;
  uniform float u_SpotCutoff;   // cos of half-angle
  uniform vec3  u_SpotColor;

  // Camera position (for specular)
  uniform vec3  u_CameraPos;

  // Phong coefficients
  uniform float u_Ka;   // ambient
  uniform float u_Kd;   // diffuse
  uniform float u_Ks;   // specular
  uniform float u_Shininess;

  vec3 phong(vec3 surfaceColor, vec3 N, vec3 L, vec3 V, vec3 lightColor) {
    float diff  = max(dot(N, L), 0.0);
    vec3  R     = reflect(-L, N);
    float spec  = pow(max(dot(V, R), 0.0), u_Shininess);
    vec3  amb   = u_Ka * surfaceColor;
    vec3  dif   = u_Kd * diff * surfaceColor * lightColor;
    vec3  spc   = u_Ks * spec * lightColor;
    return amb + dif + spc;
  }

  void main() {
    // Determine base surface color
    vec4 baseColor;
    if      (u_whichTexture == -3) {
      // Normal visualization
      gl_FragColor = vec4(abs(v_Normal), 1.0);
      return;
    }
    else if (u_whichTexture == -2) { baseColor = u_FragColor; }
    else if (u_whichTexture == -1) { baseColor = vec4(v_UV, 1.0, 1.0); }
    else if (u_whichTexture ==  0) { baseColor = texture2D(u_Sampler0, v_UV); }
    else if (u_whichTexture ==  1) { baseColor = texture2D(u_Sampler1, v_UV); }
    else                           { baseColor = vec4(1.0, 0.2, 0.2, 1.0); }

    if (!u_LightOn && !u_SpotOn) {
      gl_FragColor = baseColor;
      return;
    }

    vec3 N = normalize(v_Normal);
    vec3 V = normalize(u_CameraPos - v_WorldPos);
    vec3 color = vec3(0.0);

    // Point light contribution
    if (u_LightOn) {
      vec3 L = normalize(u_LightPos - v_WorldPos);
      color += phong(baseColor.rgb, N, L, V, u_LightColor);
    } else {
      // ambient only when light off
      color += u_Ka * baseColor.rgb;
    }

    // Spotlight contribution
    if (u_SpotOn) {
      vec3 Ls   = normalize(u_SpotPos - v_WorldPos);
      vec3 Sd   = normalize(-u_SpotDir);
      float spotDot = dot(Ls, Sd);
      if (spotDot > u_SpotCutoff) {
        float intensity = (spotDot - u_SpotCutoff) / (1.0 - u_SpotCutoff);
        color += intensity * phong(baseColor.rgb, N, Ls, V, u_SpotColor);
      }
    }

    gl_FragColor = vec4(color, baseColor.a);
  }
`;

// ============================================================
// GLOBALS
// ============================================================
let canvas, gl;
let a_Position, a_UV, a_Normal;
let u_FragColor, u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
let u_NormalMatrix, u_Sampler0, u_Sampler1, u_whichTexture;
let u_LightOn, u_SpotOn;
let u_LightPos, u_LightColor;
let u_SpotPos, u_SpotDir, u_SpotCutoff, u_SpotColor;
let u_CameraPos;
let u_Ka, u_Kd, u_Ks, u_Shininess;

// Shared GL buffers
let g_vertBuffer   = null;
let g_uvBuffer     = null;
let g_normalBuffer = null;
let g_sphereVertBuf = null, g_sphereUVBuf = null, g_sphereNormBuf = null;
let g_objVertBuf = null, g_objUVBuf = null, g_objNormBuf = null;

let camera;
const keys = {};

let g_startTime  = performance.now() / 1000.0;
let g_seconds    = 0;
let g_frameCount = 0;

// Light state
let g_lightOn      = true;
let g_spotOn       = true;
let g_normVizOn    = false;

let g_lightPos     = [16, 6, 16];   // point light
let g_lightColor   = [1.0, 0.95, 0.8];
let g_lightSlider  = 16;  // X slider position
let g_lightAnimOn  = true;

let g_spotPos      = [16, 5, 8];
let g_spotDir      = [0, -1, 0.5];  // pointing down-forward
let g_spotCutoff   = Math.cos(25 * Math.PI / 180); // 25 degree cone

// Phong coefficients
let g_Ka = 0.25, g_Kd = 0.8, g_Ks = 0.5, g_shininess = 32;

// Objects
const g_cube   = null;  // will be set after init
let g_sphere1, g_sphere2, g_objModel;
const g_cubeObj = { instance: null };

// ============================================================
// TILEMAP (from A3, same map)
// ============================================================
const g_map = [
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,4],
  [4,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,4],
  [4,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,3,3,3,0,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,4],
  [4,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,4],
  [4,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,4],
  [4,0,0,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
];

// ============================================================
// INIT
// ============================================================
function main() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl', { antialias: true });
  if (!gl) { alert('WebGL not supported'); return; }

  gl.enable(gl.DEPTH_TEST);

  if (!initShaders(gl, VSHADER, FSHADER)) { alert('Shader init failed'); return; }

  connectVariablesToGLSL();
  initTextures();
  setupEventListeners();
  setupUI();

  camera = new Camera();

  // Create scene objects
  g_sphere1 = new Sphere(32);
  g_sphere1.color = [0.2, 0.6, 1.0, 1.0];

  g_sphere2 = new Sphere(24);
  g_sphere2.color = [1.0, 0.4, 0.2, 1.0];

  g_objModel = new ObjModel();
  // Try to load teapot or similar OBJ - fallback sphere used if not found
  g_objModel.loadFromURL('teapot.obj').then(() => {
    // If real OBJ loaded, rescale it to fit scene
    console.log('OBJ ready');
  });

  requestAnimationFrame(tick);
}

// ============================================================
// CONNECT TO GLSL
// ============================================================
function connectVariablesToGLSL() {
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_UV       = gl.getAttribLocation(gl.program, 'a_UV');
  a_Normal   = gl.getAttribLocation(gl.program, 'a_Normal');

  u_FragColor        = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_ModelMatrix      = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix       = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_NormalMatrix     = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  u_Sampler0         = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1         = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_whichTexture     = gl.getUniformLocation(gl.program, 'u_whichTexture');

  u_LightOn    = gl.getUniformLocation(gl.program, 'u_LightOn');
  u_SpotOn     = gl.getUniformLocation(gl.program, 'u_SpotOn');
  u_LightPos   = gl.getUniformLocation(gl.program, 'u_LightPos');
  u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
  u_SpotPos    = gl.getUniformLocation(gl.program, 'u_SpotPos');
  u_SpotDir    = gl.getUniformLocation(gl.program, 'u_SpotDir');
  u_SpotCutoff = gl.getUniformLocation(gl.program, 'u_SpotCutoff');
  u_SpotColor  = gl.getUniformLocation(gl.program, 'u_SpotColor');
  u_CameraPos  = gl.getUniformLocation(gl.program, 'u_CameraPos');
  u_Ka         = gl.getUniformLocation(gl.program, 'u_Ka');
  u_Kd         = gl.getUniformLocation(gl.program, 'u_Kd');
  u_Ks         = gl.getUniformLocation(gl.program, 'u_Ks');
  u_Shininess  = gl.getUniformLocation(gl.program, 'u_Shininess');
}

// ============================================================
// TEXTURES (procedural, same as A3)
// ============================================================
function initTextures() {
  loadProceduralTexture(0, makeBrickTexture);
  loadProceduralTexture(1, makeGrassTexture);
}

function loadProceduralTexture(unit, fn) {
  const SIZE = 128, data = fn(SIZE);
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(unit === 0 ? u_Sampler0 : u_Sampler1, unit);
}

function makeBrickTexture(size) {
  const data = new Uint8Array(size * size * 4);
  const bH = 16, bW = 32;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / bH);
      const off = (row % 2) * (bW / 2);
      const bx = (x + off) % bW, by = y % bH;
      const mortar = by <= 1 || bx <= 1;
      const i = (y * size + x) * 4;
      if (mortar) { data[i]=180; data[i+1]=170; data[i+2]=160; data[i+3]=255; }
      else { const n=Math.floor(Math.random()*20)-10; data[i]=180+n; data[i+1]=80+n; data[i+2]=60+n; data[i+3]=255; }
    }
  }
  return data;
}

function makeGrassTexture(size) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, n = Math.floor(Math.random()*30)-15;
      data[i]=40+n; data[i+1]=120+n; data[i+2]=40+n; data[i+3]=255;
    }
  }
  return data;
}

// ============================================================
// UI SETUP
// ============================================================
function setupUI() {
  // Buttons
  document.getElementById('btn-light-on').addEventListener('click', () => {
    g_lightOn = true;
    updateButtonStates();
  });
  document.getElementById('btn-light-off').addEventListener('click', () => {
    g_lightOn = false;
    updateButtonStates();
  });
  document.getElementById('btn-spot-on').addEventListener('click', () => {
    g_spotOn = true;
    updateButtonStates();
  });
  document.getElementById('btn-spot-off').addEventListener('click', () => {
    g_spotOn = false;
    updateButtonStates();
  });
  document.getElementById('btn-norm-on').addEventListener('click', () => {
    g_normVizOn = true;
    updateButtonStates();
  });
  document.getElementById('btn-norm-off').addEventListener('click', () => {
    g_normVizOn = false;
    updateButtonStates();
  });

  // Light X slider
  document.getElementById('slider-light-x').addEventListener('input', e => {
    g_lightSlider = parseFloat(e.target.value);
    g_lightPos[0] = g_lightSlider;
    g_lightAnimOn = false;
  });

  // Light Y slider
  document.getElementById('slider-light-y').addEventListener('input', e => {
    g_lightPos[1] = parseFloat(e.target.value);
  });

  // Light Z slider
  document.getElementById('slider-light-z').addEventListener('input', e => {
    g_lightPos[2] = parseFloat(e.target.value);
  });

  // Light color sliders
  document.getElementById('slider-light-r').addEventListener('input', e => { g_lightColor[0] = parseFloat(e.target.value); });
  document.getElementById('slider-light-g').addEventListener('input', e => { g_lightColor[1] = parseFloat(e.target.value); });
  document.getElementById('slider-light-b').addEventListener('input', e => { g_lightColor[2] = parseFloat(e.target.value); });

  // Phong sliders
  document.getElementById('slider-ka').addEventListener('input', e => { g_Ka = parseFloat(e.target.value); });
  document.getElementById('slider-kd').addEventListener('input', e => { g_Kd = parseFloat(e.target.value); });
  document.getElementById('slider-ks').addEventListener('input', e => { g_Ks = parseFloat(e.target.value); });
  document.getElementById('slider-shin').addEventListener('input', e => { g_shininess = parseFloat(e.target.value); });

  updateButtonStates();
}

function updateButtonStates() {
  document.getElementById('btn-light-on').classList.toggle('active', g_lightOn);
  document.getElementById('btn-light-off').classList.toggle('active', !g_lightOn);
  document.getElementById('btn-spot-on').classList.toggle('active', g_spotOn);
  document.getElementById('btn-spot-off').classList.toggle('active', !g_spotOn);
  document.getElementById('btn-norm-on').classList.toggle('active', g_normVizOn);
  document.getElementById('btn-norm-off').classList.toggle('active', !g_normVizOn);
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('click', () => canvas.requestPointerLock());
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) camera.panByPixels(e.movementX, e.movementY);
  });
}

function handleKeys() {
  if (keys['w']) camera.moveForward();
  if (keys['s']) camera.moveBackwards();
  if (keys['a']) camera.moveLeft();
  if (keys['d']) camera.moveRight();
  if (keys['q']) camera.panLeft();
  if (keys['e']) camera.panRight();
}

// ============================================================
// TICK / ANIMATION
// ============================================================
function tick() {
  g_seconds    = performance.now() / 1000.0 - g_startTime;
  g_frameCount++;

  // Animate light position in a circle if anim is on
  if (g_lightAnimOn) {
    g_lightPos[0] = 16 + 8 * Math.cos(g_seconds * 0.8);
    g_lightPos[2] = 16 + 8 * Math.sin(g_seconds * 0.8);
    // Update slider display
    document.getElementById('slider-light-x').value = g_lightPos[0].toFixed(1);
    document.getElementById('slider-light-z').value = g_lightPos[2].toFixed(1);
  }

  // Animate spotlight direction — slowly sweeps
  g_spotDir[0] = Math.sin(g_seconds * 0.4);
  g_spotDir[2] = Math.cos(g_seconds * 0.4);

  handleKeys();
  renderAllShapes();

  if (g_frameCount % 30 === 0) {
    const fps = Math.round(g_frameCount / g_seconds);
    document.getElementById('fps').textContent = 'FPS: ' + fps;
  }

  requestAnimationFrame(tick);
}

// ============================================================
// RENDER
// ============================================================
const _cube = new Cube();  // reusable cube

function renderAllShapes() {
  gl.clearColor(0.08, 0.08, 0.12, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Camera matrices
  gl.uniformMatrix4fv(u_ViewMatrix,       false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);

  // Pass camera position for specular
  const eye = camera.eye.elements;
  gl.uniform3f(u_CameraPos, eye[0], eye[1], eye[2]);

  // Pass lighting uniforms
  gl.uniform1i(u_LightOn,  g_lightOn);
  gl.uniform1i(u_SpotOn,   g_spotOn);
  gl.uniform3fv(u_LightPos,   g_lightPos);
  gl.uniform3fv(u_LightColor, g_lightColor);
  gl.uniform3fv(u_SpotPos,    g_spotPos);
  gl.uniform3fv(u_SpotDir,    g_spotDir);
  gl.uniform1f(u_SpotCutoff,  g_spotCutoff);
  gl.uniform3f(u_SpotColor,   0.6, 0.9, 1.0);  // cool blue spotlight

  // Phong coefficients
  gl.uniform1f(u_Ka, g_Ka);
  gl.uniform1f(u_Kd, g_Kd);
  gl.uniform1f(u_Ks, g_Ks);
  gl.uniform1f(u_Shininess, g_shininess);

  const normTex = g_normVizOn ? -3 : -999; // -3 triggers normal viz in shader

  // ---- GROUND ----
  _cube.color      = [0.3, 0.55, 0.3, 1.0];
  _cube.textureNum = g_normVizOn ? -3 : 1;
  _cube.matrix.setIdentity();
  _cube.matrix.translate(-1, -0.02, -1);
  _cube.matrix.scale(34, 0.04, 34);
  _cube.render();

  // ---- WALLS (from tilemap) ----
  _cube.textureNum = g_normVizOn ? -3 : 0;
  _cube.color = [1, 1, 1, 1];
  for (let z = 0; z < 32; z++) {
    for (let x = 0; x < 32; x++) {
      const h = g_map[z][x];
      if (h === 0) continue;
      for (let y = 0; y < h; y++) {
        _cube.matrix.setIdentity();
        _cube.matrix.translate(x, y, z);
        _cube.render();
      }
    }
  }

  // ---- SPHERE 1 (blue, shiny) ----
  g_sphere1.textureNum = g_normVizOn ? -3 : -2;
  g_sphere1.matrix.setIdentity();
  g_sphere1.matrix.translate(12, 1.5, 12);
  g_sphere1.matrix.scale(1.5, 1.5, 1.5);
  g_sphere1.render();

  // ---- SPHERE 2 (orange, matte) ----
  const oldKs = g_Ks;
  gl.uniform1f(u_Ks, 0.1);  // low specular for matte sphere
  g_sphere2.textureNum = g_normVizOn ? -3 : -2;
  g_sphere2.matrix.setIdentity();
  g_sphere2.matrix.translate(20, 1.5, 12);
  g_sphere2.matrix.scale(1.5, 1.5, 1.5);
  g_sphere2.render();
  gl.uniform1f(u_Ks, oldKs);

  // ---- OBJ MODEL ----
  if (g_objModel.loaded) {
    g_objModel.textureNum = g_normVizOn ? -3 : -2;
    g_objModel.color = [0.85, 0.75, 0.6, 1.0];
    g_objModel.matrix.setIdentity();
    g_objModel.matrix.translate(16, 0, 20);
    g_objModel.matrix.scale(1.5, 1.5, 1.5);
    g_objModel.render();
  }

  // ---- POINT LIGHT MARKER (bright yellow cube, inside-out so normals face in) ----
  _cube.textureNum = -2;
  _cube.color = [g_lightColor[0]*3, g_lightColor[1]*3, g_lightColor[2]*3, 1.0];
  _cube.matrix.setIdentity();
  _cube.matrix.translate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  _cube.matrix.scale(-0.3, -0.3, -0.3);  // negative scale = inside-out normals
  gl.uniform1i(u_LightOn, false);  // light marker always fully bright
  gl.uniform1i(u_SpotOn,  false);
  _cube.render();

  // ---- SPOTLIGHT MARKER (small cyan sphere) ----
  g_sphere1.textureNum = -2;
  const tmpColor = g_sphere1.color;
  g_sphere1.color = [0.4, 0.9, 1.0, 1.0];
  g_sphere1.matrix.setIdentity();
  g_sphere1.matrix.translate(g_spotPos[0], g_spotPos[1], g_spotPos[2]);
  g_sphere1.matrix.scale(0.2, 0.2, 0.2);
  g_sphere1.render();
  g_sphere1.color = tmpColor;

  // Restore lighting uniforms for rest of frame
  gl.uniform1i(u_LightOn, g_lightOn);
  gl.uniform1i(u_SpotOn,  g_spotOn);
}

// ============================================================
// SHADER INIT HELPERS
// ============================================================
function initShaders(gl, vs, fs) {
  const v = createShader(gl, gl.VERTEX_SHADER, vs);
  const f = createShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return false;
  const p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('Link error:', gl.getProgramInfoLog(p)); return false;
  }
  gl.useProgram(p); gl.program = p; return true;
}

function createShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader error:', gl.getShaderInfoLog(s)); return null;
  }
  return s;
}
