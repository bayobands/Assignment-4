// cube.js — Cube class for CSE 160 Assignment 4
// Added: per-face normals attribute buffer

class Cube {
  constructor() {
    this.color      = [1, 1, 1, 1];
    this.textureNum = -2;   // -3=normals, -2=color, -1=UV, 0=tex0, 1=tex1
    this.matrix     = new Matrix4();
    this.normalMatrix = new Matrix4();

    // 36 vertices (12 triangles), positions
    this._verts32 = new Float32Array([
      // Front  (z=1)  normal 0,0,1
      0,0,1, 1,0,1, 1,1,1,  0,0,1, 1,1,1, 0,1,1,
      // Back   (z=0)  normal 0,0,-1
      1,0,0, 0,0,0, 0,1,0,  1,0,0, 0,1,0, 1,1,0,
      // Left   (x=0)  normal -1,0,0
      0,0,0, 0,0,1, 0,1,1,  0,0,0, 0,1,1, 0,1,0,
      // Right  (x=1)  normal 1,0,0
      1,0,1, 1,0,0, 1,1,0,  1,0,1, 1,1,0, 1,1,1,
      // Top    (y=1)  normal 0,1,0
      0,1,1, 1,1,1, 1,1,0,  0,1,1, 1,1,0, 0,1,0,
      // Bottom (y=0)  normal 0,-1,0
      0,0,0, 1,0,0, 1,0,1,  0,0,0, 1,0,1, 0,0,1,
    ]);

    this._uvs32 = new Float32Array([
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,  // Front
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,  // Back
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,  // Left
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,  // Right
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,  // Top
      0,0, 1,0, 1,1,  0,0, 1,1, 0,1,  // Bottom
    ]);

    // Per-vertex normals — same normal repeated 6 times per face
    const n = (x,y,z) => [x,y,z, x,y,z, x,y,z, x,y,z, x,y,z, x,y,z];
    this._normals32 = new Float32Array([
      ...n( 0, 0, 1),   // Front
      ...n( 0, 0,-1),   // Back
      ...n(-1, 0, 0),   // Left
      ...n( 1, 0, 0),   // Right
      ...n( 0, 1, 0),   // Top
      ...n( 0,-1, 0),   // Bottom
    ]);
  }

  render() {
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1i(u_whichTexture, this.textureNum);
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    // Normal matrix = inverse-transpose of model matrix
    this.normalMatrix.setInverseOf(this.matrix);
    this.normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, this.normalMatrix.elements);

    // Position buffer
    if (!g_vertBuffer) g_vertBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_vertBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._verts32, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    // UV buffer
    if (!g_uvBuffer) g_uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._uvs32, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);

    // Normal buffer
    if (!g_normalBuffer) g_normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._normals32, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
}
