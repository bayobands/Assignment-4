// objmodel.js — OBJ file loader for CSE 160 Assignment 4
// Parses position, normal, and face data from .obj text

class ObjModel {
  constructor() {
    this.color      = [0.8, 0.7, 0.6, 1.0];
    this.textureNum = -2;
    this.matrix     = new Matrix4();
    this.normalMatrix = new Matrix4();
    this._verts32   = null;
    this._normals32 = null;
    this._count     = 0;
    this.loaded     = false;
  }

  // Parse OBJ text string
  parseOBJ(text) {
    const positions = [];
    const normals   = [];
    const outVerts  = [];
    const outNorms  = [];

    const lines = text.split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'v') {
        positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (parts[0] === 'vn') {
        normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (parts[0] === 'f') {
        // Triangulate face (fan from first vertex)
        const faceVerts = parts.slice(1);
        for (let i = 1; i < faceVerts.length - 1; i++) {
          const tri = [faceVerts[0], faceVerts[i], faceVerts[i+1]];
          for (const token of tri) {
            const idx = token.split('/');
            const vi = parseInt(idx[0]) - 1;
            const ni = idx[2] ? parseInt(idx[2]) - 1 : -1;
            if (positions[vi]) outVerts.push(...positions[vi]);
            if (ni >= 0 && normals[ni]) {
              outNorms.push(...normals[ni]);
            } else if (positions[vi]) {
              // fallback: use position as normal (works well for convex shapes)
              const p = positions[vi];
              const len = Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2]) || 1;
              outNorms.push(p[0]/len, p[1]/len, p[2]/len);
            }
          }
        }
      }
    }

    this._verts32   = new Float32Array(outVerts);
    this._normals32 = new Float32Array(outNorms);
    // Build zero UVs
    this._uvs32     = new Float32Array(outVerts.length / 3 * 2);
    this._count     = outVerts.length / 3;
    this.loaded     = true;
    console.log(`OBJ loaded: ${this._count} triangles`);
  }

  // Load from URL
  async loadFromURL(url) {
    try {
      const r = await fetch(url);
      const text = await r.text();
      this.parseOBJ(text);
    } catch(e) {
      console.warn('OBJ load failed, using fallback sphere:', e);
      this._buildFallback();
    }
  }

  // Fallback: generate a simple icosphere-like shape if no OBJ available
  _buildFallback() {
    // Use a sphere mesh as fallback
    const divs = 16;
    const verts = [], norms = [], uvs = [];
    for (let i = 0; i < divs; i++) {
      const t1 = (i / divs) * Math.PI;
      const t2 = ((i+1) / divs) * Math.PI;
      for (let j = 0; j < divs; j++) {
        const p1 = (j / divs) * 2 * Math.PI;
        const p2 = ((j+1) / divs) * 2 * Math.PI;
        const pt = (t, p) => [Math.sin(t)*Math.cos(p), Math.cos(t), Math.sin(t)*Math.sin(p)];
        const [p00,p10,p01,p11] = [pt(t1,p1),pt(t2,p1),pt(t1,p2),pt(t2,p2)];
        verts.push(...p00,...p10,...p11,...p00,...p11,...p01);
        norms.push(...p00,...p10,...p11,...p00,...p11,...p01);
        uvs.push(0,0, 0,0, 0,0, 0,0, 0,0, 0,0);
      }
    }
    this._verts32 = new Float32Array(verts);
    this._normals32 = new Float32Array(norms);
    this._uvs32 = new Float32Array(uvs);
    this._count = verts.length / 3;
    this.loaded = true;
  }

  render() {
    if (!this.loaded) return;
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1i(u_whichTexture, this.textureNum);
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    this.normalMatrix.setInverseOf(this.matrix);
    this.normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, this.normalMatrix.elements);

    if (!g_objVertBuf) g_objVertBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_objVertBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this._verts32, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    if (!g_objUVBuf) g_objUVBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_objUVBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this._uvs32, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);

    if (!g_objNormBuf) g_objNormBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_objNormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this._normals32, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, this._count);
  }
}
