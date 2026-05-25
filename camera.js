// camera.js — Camera class for CSE 160 Assignment 4
class Camera {
  constructor() {
    this.fov = 60;
    this.eye = new Vector3([16, 2, 24]);
    this.at  = new Vector3([16, 2, 16]);
    this.up  = new Vector3([0, 1, 0]);
    this.viewMatrix       = new Matrix4();
    this.projectionMatrix = new Matrix4();
    this.speed    = 0.15;
    this.panSpeed = 4;
    this._updateMatrices();
  }

  _updateMatrices() {
    const e = this.eye.elements, a = this.at.elements, u = this.up.elements;
    this.viewMatrix.setLookAt(e[0],e[1],e[2], a[0],a[1],a[2], u[0],u[1],u[2]);
    this.projectionMatrix.setPerspective(this.fov, canvas.width/canvas.height, 0.1, 1000);
  }

  moveForward()   { this._move(1);  }
  moveBackwards() { this._move(-1); }
  _move(sign) {
    let f = new Vector3(); f.set(this.at); f.sub(this.eye); f.normalize(); f.mul(sign * this.speed);
    this.eye.add(f); this.at.add(f); this._updateMatrices();
  }
  moveLeft()  { this._strafe(-1); }
  moveRight() { this._strafe(1);  }
  _strafe(sign) {
    let f = new Vector3(); f.set(this.at); f.sub(this.eye);
    let s = (sign > 0) ? f.cross(this.up) : this.up.cross(f);
    s.normalize(); s.mul(this.speed);
    this.eye.add(s); this.at.add(s); this._updateMatrices();
  }
  panLeft()  { this._pan(this.panSpeed);  }
  panRight() { this._pan(-this.panSpeed); }
  _pan(deg) {
    let f = new Vector3(); f.set(this.at); f.sub(this.eye);
    let rot = new Matrix4();
    const u = this.up.elements;
    rot.setRotate(deg, u[0], u[1], u[2]);
    let fp = rot.multiplyVector3(f);
    const e = this.eye.elements, fpe = fp.elements;
    this.at.elements[0] = e[0]+fpe[0];
    this.at.elements[1] = e[1]+fpe[1];
    this.at.elements[2] = e[2]+fpe[2];
    this._updateMatrices();
  }
  panByPixels(dx, dy) {
    this._pan(dx * 0.2);
    let f = new Vector3(); f.set(this.at); f.sub(this.eye);
    let side = f.cross(this.up); side.normalize();
    const s = side.elements;
    let rot = new Matrix4(); rot.setRotate(-dy * 0.2, s[0], s[1], s[2]);
    let fp = rot.multiplyVector3(f);
    const e = this.eye.elements, fpe = fp.elements;
    this.at.elements[0] = e[0]+fpe[0];
    this.at.elements[1] = e[1]+fpe[1];
    this.at.elements[2] = e[2]+fpe[2];
    this._updateMatrices();
  }

  // Returns [ex,ey,ez] as flat array for passing to shader
  getEyeArray() { return this.eye.elements; }
}
