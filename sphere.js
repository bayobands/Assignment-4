// sphere.js — Sphere class for CSE 160 Assignment 4
// Generates a UV-sphere mesh with proper normals

class Sphere {
  constructor(divisions = 24) {
    this.color      = [1, 1, 1, 1];
    this.textureNum = -2;
    this.matrix     = new Matrix4();
    this.normalMatrix = new Matrix4();

    this._buildMesh(divisions);
  }

  _buildMesh(divs) {
    const verts = [], uvs = [], normals = [];

    for (let i = 0; i < divs; i++) {
      const theta1 = (i     / divs) * Math.PI;
      const theta2 = ((i+1) / divs) * Math.PI;

      for (let j = 0; j < divs; j++) {
        const phi1 = (j     / divs) * 2 * Math.PI;
        const phi2 = ((j+1) / divs) * 2 * Math.PI;

        // Four corners of a quad on the sphere surface
        const p = (t, p) => [
          Math.sin(t) * Math.cos(p),
          Math.cos(t),
          Math.sin(t) * Math.sin(p)
        ];
        const p00 = p(theta1, phi1);
        const p10 = p(theta2, phi1);
        const p01 = p(theta1, phi2);
        const p11 = p(theta2, phi2);

        const uv = (ti, pj) => [pj / divs, 1 - ti / divs];
        const uv00 = uv(i,   j);
        const uv10 = uv(i+1, j);
        const uv01 = uv(i,   j+1);
        const uv11 = uv(i+1, j+1);

        // Triangle 1: p00, p10, p11
        verts.push(...p00, ...p10, ...p11);
        normals.push(...p00, ...p10, ...p11); // sphere: normal = position (unit sphere)
        uvs.push(...uv00, ...uv10, ...uv11);

        // Triangle 2: p00, p11, p01
        verts.push(...p00, ...p11, ...p01);
        normals.push(...p00, ...p11, ...p01);
        uvs.push(...uv00, ...uv11, ...uv01);
      }
    }

    this._verts32   = new Float32Array(verts);
    this._normals32 = new Float32Array(normals);
    this._uvs32     = new Float32Array(uvs);
    this._count     = verts.length / 3;
  }

  render() {
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1i(u_whichTexture, this.textureNum);
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    this.normalMatrix.setInverseOf(this.matrix);
    this.normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, this.normalMatrix.elements);

    if (!g_sphereVertBuf) g_sphereVertBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_sphereVertBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this._verts32, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    if (!g_sphereUVBuf) g_sphereUVBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_sphereUVBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this._uvs32, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);

    if (!g_sphereNormBuf) g_sphereNormBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_sphereNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this._normals32, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, this._count);
  }
}
