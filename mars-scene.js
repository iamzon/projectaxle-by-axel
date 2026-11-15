(() => {
  const canvas = document.getElementById('mars-canvas');
  const panel = document.getElementById('world-panel');
  const status = document.getElementById('world-warning');
  if (!canvas || !panel) return;

  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    uniform mat4 uViewProjection;
    varying vec3 vColor;
    varying vec3 vNormal;
    void main() {
      gl_Position = uViewProjection * vec4(aPosition, 1.0);
      vColor = aColor;
      vNormal = aNormal;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec3 vColor;
    varying vec3 vNormal;
    void main() {
      vec3 lightDirection = normalize(vec3(-0.45, 0.82, 0.38));
      float diffuse = max(dot(normalize(vNormal), lightDirection), 0.0);
      float lighting = 0.43 + diffuse * 0.68;
      gl_FragColor = vec4(vColor * lighting, 1.0);
    }
  `;

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || 'Unable to compile a 3D scene shader.');
    }
    return shader;
  }

  function createProgram(gl) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(message || 'Unable to link the 3D scene program.');
    }
    return program;
  }

  function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  }

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function perspective(fieldOfView, aspect, near, far) {
    const f = 1 / Math.tan(fieldOfView / 2);
    const range = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * range, -1,
      0, 0, near * far * 2 * range, 0
    ]);
  }

  function lookAt(eye, target) {
    const z = normalize(subtract(eye, target));
    const x = normalize(cross([0, 1, 0], z));
    const y = cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
      -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
      -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
      1
    ]);
  }

  function multiply(a, b) {
    const result = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        result[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    return result;
  }

  function terrainHeight(x, z) {
    const edgeDistance = Math.max(Math.abs(x), Math.abs(z));
    const transition = Math.max(0, Math.min(1, (edgeDistance - 7) / 3));
    const terrainBlend = transition * transition * (3 - 2 * transition);
    const surface = Math.sin(x * 0.56 + z * 0.22) * 0.13 + Math.cos(z * 0.48 - x * 0.19) * 0.1;
    return surface * terrainBlend;
  }

  function makeGeometry(mission) {
    const positions = [];
    const normals = [];
    const colors = [];

    function triangle(a, b, c, color, normal) {
      const faceNormal = normal || normalize(cross(subtract(b, a), subtract(c, a)));
      for (const point of [a, b, c]) {
        positions.push(point[0], point[1], point[2]);
        normals.push(faceNormal[0], faceNormal[1], faceNormal[2]);
        colors.push(color[0], color[1], color[2]);
      }
    }

    function quad(a, b, c, d, color, normal) {
      triangle(a, b, c, color, normal);
      triangle(a, c, d, color, normal);
    }

    function box(x, y, z, width, height, depth, color) {
      const x0 = x - width / 2, x1 = x + width / 2;
      const y0 = y - height / 2, y1 = y + height / 2;
      const z0 = z - depth / 2, z1 = z + depth / 2;
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, [0, 0, 1]);
      quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, [0, 0, -1]);
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, [1, 0, 0]);
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, [-1, 0, 0]);
      quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color, [0, 1, 0]);
      quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, [0, -1, 0]);
    }

    function sphere(x, y, z, radius, color, rings, segments, domeOnly) {
      const lastRing = domeOnly ? Math.floor(rings / 2) : rings;
      for (let ring = 0; ring < lastRing; ring += 1) {
        const latitude0 = Math.PI * ring / rings;
        const latitude1 = Math.PI * (ring + 1) / rings;
        for (let segment = 0; segment < segments; segment += 1) {
          const longitude0 = 2 * Math.PI * segment / segments;
          const longitude1 = 2 * Math.PI * (segment + 1) / segments;
          const point = (latitude, longitude) => [
            x + radius * Math.sin(latitude) * Math.cos(longitude),
            y + radius * Math.cos(latitude),
            z + radius * Math.sin(latitude) * Math.sin(longitude)
          ];
          const normal = (latitude, longitude) => normalize([
            Math.sin(latitude) * Math.cos(longitude),
            Math.cos(latitude),
            Math.sin(latitude) * Math.sin(longitude)
          ]);
          const a = point(latitude0, longitude0), b = point(latitude1, longitude0);
          const c = point(latitude1, longitude1), d = point(latitude0, longitude1);
          triangle(a, b, c, color, normal((latitude0 + latitude1 * 2) / 3, (longitude0 * 2 + longitude1) / 3));
          triangle(a, c, d, color, normal((latitude0 * 2 + latitude1) / 3, (longitude0 + longitude1 * 2) / 3));
        }
      }
    }

    function cylinder(x, y, z, radius, height, color, segments) {
      const lower = y - height / 2, upper = y + height / 2;
      for (let i = 0; i < segments; i += 1) {
        const a = 2 * Math.PI * i / segments, b = 2 * Math.PI * (i + 1) / segments;
        const p0 = [x + Math.cos(a) * radius, lower, z + Math.sin(a) * radius];
        const p1 = [x + Math.cos(b) * radius, lower, z + Math.sin(b) * radius];
        const p2 = [x + Math.cos(b) * radius, upper, z + Math.sin(b) * radius];
        const p3 = [x + Math.cos(a) * radius, upper, z + Math.sin(a) * radius];
        const sideNormal = normalize([Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)]);
        quad(p0, p1, p2, p3, color, sideNormal);
        triangle([x, upper, z], p3, p2, color, [0, 1, 0]);
        triangle([x, lower, z], p1, p0, color, [0, -1, 0]);
      }
    }

    function cylinderBetween(start, end, radius, color, segments) {
      const axis = normalize(subtract(end, start));
      const helper = Math.abs(axis[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0];
      const u = normalize(cross(axis, helper));
      const v = normalize(cross(axis, u));
      for (let i = 0; i < segments; i += 1) {
        const a = 2 * Math.PI * i / segments, b = 2 * Math.PI * (i + 1) / segments;
        const radialA = [u[0] * Math.cos(a) + v[0] * Math.sin(a), u[1] * Math.cos(a) + v[1] * Math.sin(a), u[2] * Math.cos(a) + v[2] * Math.sin(a)];
        const radialB = [u[0] * Math.cos(b) + v[0] * Math.sin(b), u[1] * Math.cos(b) + v[1] * Math.sin(b), u[2] * Math.cos(b) + v[2] * Math.sin(b)];
        const p0 = [start[0] + radialA[0] * radius, start[1] + radialA[1] * radius, start[2] + radialA[2] * radius];
        const p1 = [start[0] + radialB[0] * radius, start[1] + radialB[1] * radius, start[2] + radialB[2] * radius];
        const p2 = [end[0] + radialB[0] * radius, end[1] + radialB[1] * radius, end[2] + radialB[2] * radius];
        const p3 = [end[0] + radialA[0] * radius, end[1] + radialA[1] * radius, end[2] + radialA[2] * radius];
        const radial = normalize([radialA[0] + radialB[0], radialA[1] + radialB[1], radialA[2] + radialB[2]]);
        quad(p0, p1, p2, p3, color, radial);
      }
    }

    function solarArray(x, z, direction) {
      const y = terrainHeight(x, z);
      cylinder(x, y + 0.34, z, 0.055, 0.68, [0.62, 0.52, 0.4], 8);
      const angle = direction || 0;
      const panelColor = [0.11, 0.28, 0.38];
      for (let side = -1; side <= 1; side += 1) {
        const offset = side * 0.83;
        const px = x + Math.cos(angle) * offset, pz = z + Math.sin(angle) * offset;
        box(px, y + 0.73, pz, 0.76, 0.07, 1.24, panelColor);
        box(px, y + 0.78, pz, 0.025, 0.025, 1.25, [0.59, 0.76, 0.79]);
        box(px - 0.26, y + 0.78, pz, 0.018, 0.025, 1.25, [0.42, 0.59, 0.65]);
        box(px + 0.26, y + 0.78, pz, 0.018, 0.025, 1.25, [0.42, 0.59, 0.65]);
      }
    }

    function addTerrain() {
      const size = 46, segments = 44, step = size / segments;
      const start = -size / 2;
      for (let row = 0; row < segments; row += 1) {
        for (let column = 0; column < segments; column += 1) {
          const x0 = start + column * step, x1 = x0 + step;
          const z0 = start + row * step, z1 = z0 + step;
          const a = [x0, terrainHeight(x0, z0), z0];
          const b = [x1, terrainHeight(x1, z0), z0];
          const c = [x1, terrainHeight(x1, z1), z1];
          const d = [x0, terrainHeight(x0, z1), z1];
          const shade = Math.sin(column * 2.17 + row * 0.73) * 0.006;
          const color = [0.47 + shade, 0.245 + shade * 0.65, 0.155 + shade * 0.38];
          triangle(a, c, b, color, [0, 1, 0]);
          triangle(a, d, c, color, [0, 1, 0]);
        }
      }
    }

    function addRock(x, z, scale, color) {
      const y = terrainHeight(x, z) + scale * 0.34;
      sphere(x, y, z, scale, color, 5, 7, false);
      box(x, terrainHeight(x, z) + scale * 0.12, z, scale * 1.25, scale * 0.35, scale, color);
    }

    function addCliff(x, z, width, height, depth, color) {
      const basePoints = [
        [x - width / 2, z - depth / 2],
        [x + width / 2, z - depth / 2],
        [x + width / 2, z + depth / 2],
        [x - width / 2, z + depth / 2]
      ];
      const topPoints = [
        [x - width * 0.38, z - depth * 0.34, 0.82],
        [x + width * 0.28, z - depth * 0.42, 1],
        [x + width * 0.43, z + depth * 0.2, 0.76],
        [x - width * 0.24, z + depth * 0.43, 0.91]
      ];
      const base = basePoints.map(([pointX, pointZ]) => [pointX, terrainHeight(pointX, pointZ), pointZ]);
      const top = topPoints.map(([pointX, pointZ, heightScale]) => [
        x + pointX,
        terrainHeight(x + pointX, z + pointZ) + height * heightScale,
        z + pointZ
      ]);
      const sideNormals = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
      for (let index = 0; index < 4; index += 1) {
        const next = (index + 1) % 4;
        const shade = index % 2 === 0 ? 1 : 0.82;
        const sideColor = color.map((channel) => channel * shade);
        quad(base[index], base[next], top[next], top[index], sideColor, sideNormals[index]);
      }
      const capColor = color.map((channel) => Math.min(1, channel * 1.18));
      triangle(top[0], top[1], top[2], capColor, [0, 1, 0]);
      triangle(top[0], top[2], top[3], capColor, [0, 1, 0]);
    }

    function addPerimeterFeatures() {
      const cliffs = [
        [-15, -14, 8, 3.2, 3, [0.42, 0.26, 0.2]],
        [-5, -17, 7, 2.5, 3.5, [0.49, 0.29, 0.21]],
        [5, -17, 8, 3.6, 3, [0.4, 0.25, 0.19]],
        [15, -13, 7, 2.8, 3, [0.5, 0.3, 0.21]],
        [17, -2, 3, 2.6, 8, [0.44, 0.27, 0.2]],
        [16, 9, 3.5, 3.4, 7, [0.51, 0.31, 0.22]],
        [10, 16, 8, 2.8, 3, [0.43, 0.25, 0.18]],
        [0, 18, 8, 3.3, 3, [0.49, 0.3, 0.22]],
        [-11, 16, 8, 2.7, 3.5, [0.4, 0.24, 0.19]],
        [-17, 7, 3, 3, 8, [0.48, 0.28, 0.2]],
        [-17, -5, 3, 2.3, 6, [0.43, 0.27, 0.2]]
      ];
      cliffs.forEach((cliff) => addCliff(...cliff));

      for (let index = 0; index < 32; index += 1) {
        const angle = index * 2.399963 + 0.4;
        const distance = 10.5 + (index % 6) * 1.7;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const scale = 0.3 + ((index * 7) % 6) * 0.09;
        const color = index % 3 === 0 ? [0.4, 0.25, 0.2] : [0.52, 0.31, 0.22];
        addRock(x, z, scale, color);
      }
    }

    function addHabitat() {
      const x = 1.2, z = 0.2, ground = terrainHeight(x, z);
      cylinder(x, ground + 0.53, z, 1.08, 1.05, [0.69, 0.62, 0.51], 20);
      sphere(x, ground + 1.04, z, 1.08, [0.81, 0.72, 0.58], 12, 24, true);
      cylinder(x, ground + 0.06, z, 1.1, 0.12, [0.37, 0.39, 0.34], 20);
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
        const px = x + Math.cos(angle) * 0.72, pz = z + Math.sin(angle) * 0.72;
        box(px, ground + 0.72, pz, 0.16, 0.2, 0.04, [0.19, 0.36, 0.43]);
      }
      box(x, ground + 0.25, z + 1.2, 0.72, 0.43, 0.72, [0.72, 0.66, 0.54]);
      cylinder(x, ground + 1.85, z, 0.075, 0.4, [0.51, 0.55, 0.46], 8);
      sphere(x, ground + 2.07, z, 0.14, [0.73, 0.68, 0.52], 6, 8, false);
      if (mission.deployed.includes('lifeSupport')) {
        for (let i = 0; i < 3; i += 1) {
          cylinder(x - 0.65 + i * 0.65, ground + 0.52, z - 1.37, 0.19, 0.92, [0.68, 0.75, 0.71], 12);
          cylinder(x - 0.65 + i * 0.65, ground + 0.98, z - 1.37, 0.19, 0.07, [0.31, 0.52, 0.53], 12);
        }
      }
    }

    function addGreenhouse() {
      const x = 0.9, z = -3.1, ground = terrainHeight(x, z);
      cylinder(x, ground + 0.09, z, 1.03, 0.18, [0.46, 0.43, 0.34], 20);
      sphere(x, ground + 0.15, z, 1.0, [0.66, 0.56, 0.4], 12, 20, true);
      for (let i = -2; i <= 2; i += 1) {
        const plantX = x + i * 0.31;
        cylinderBetween([plantX, ground + 0.12, z - 0.42], [plantX + 0.08, ground + 0.48 + Math.abs(i) * 0.04, z - 0.33], 0.035, [0.34, 0.54, 0.27], 6);
        sphere(plantX + 0.08, ground + 0.46 + Math.abs(i) * 0.04, z - 0.33, 0.13, [0.39, 0.61, 0.3], 5, 7, false);
      }
    }

    function addStormAnchors() {
      const points = [[-0.8, -0.8], [2.4, -0.8], [-0.8, 1.2], [2.4, 1.2]];
      for (const [x, z] of points) {
        const y = terrainHeight(x, z);
        cylinder(x, y + 0.48, z, 0.045, 0.96, [0.63, 0.58, 0.46], 7);
        box(x, y + 0.08, z, 0.28, 0.12, 0.28, [0.37, 0.4, 0.36]);
      }
    }

    function addRadiationShelter() {
      for (let i = 0; i < 8; i += 1) {
        const angle = i * Math.PI / 4;
        const x = 1.2 + Math.cos(angle) * 1.65;
        const z = 0.2 + Math.sin(angle) * 1.65;
        const y = terrainHeight(x, z);
        box(x, y + 0.62, z, 0.42, 1.18, 0.12, [0.59, 0.68, 0.65]);
        box(x, y + 1.24, z, 0.46, 0.08, 0.16, [0.78, 0.69, 0.5]);
      }
    }

    function addIceDrill() {
      const x = 4.1, z = 2.0, y = terrainHeight(x, z);
      box(x, y + 0.38, z, 1.0, 0.72, 0.8, [0.61, 0.58, 0.48]);
      cylinderBetween([x, y + 0.68, z], [x, y + 1.8, z], 0.09, [0.65, 0.72, 0.68], 10);
      cylinderBetween([x, y + 1.38, z], [x + 0.55, y + 1.65, z], 0.055, [0.73, 0.69, 0.56], 8);
      box(x + 0.12, y + 1.1, z, 0.28, 0.24, 0.32, [0.22, 0.39, 0.43]);
    }

    function addWorkshop() {
      const x = -3.2, z = 2.7, y = terrainHeight(x, z);
      box(x, y + 0.75, z, 1.65, 1.45, 1.3, [0.67, 0.58, 0.46]);
      box(x, y + 1.52, z, 1.78, 0.11, 1.4, [0.47, 0.48, 0.41]);
      box(x, y + 0.78, z + 0.66, 0.48, 0.72, 0.05, [0.21, 0.38, 0.42]);
      box(x - 0.48, y + 0.55, z + 0.68, 0.28, 0.2, 0.08, [0.76, 0.67, 0.5]);
    }

    function addCommsRelay() {
      const x = 4.6, z = -2.7, y = terrainHeight(x, z);
      cylinderBetween([x, y, z], [x, y + 3.2, z], 0.055, [0.62, 0.64, 0.56], 8);
      cylinderBetween([x - 0.65, y + 1.2, z], [x + 0.65, y + 1.2, z], 0.035, [0.63, 0.68, 0.61], 8);
      sphere(x, y + 3.22, z, 0.22, [0.72, 0.76, 0.69], 7, 12, false);
      box(x + 0.4, y + 2.2, z, 0.42, 0.26, 0.08, [0.19, 0.39, 0.48]);
    }

    function addMedicalBay() {
      const x = 3.0, z = -0.5, y = terrainHeight(x, z);
      box(x, y + 0.64, z, 1.25, 1.18, 1.15, [0.72, 0.72, 0.65]);
      box(x, y + 0.68, z + 0.58, 0.46, 0.76, 0.04, [0.24, 0.42, 0.46]);
      box(x, y + 1.42, z - 0.02, 0.42, 0.34, 0.06, [0.82, 0.81, 0.72]);
      box(x, y + 1.42, z - 0.02, 0.12, 0.43, 0.08, [0.8, 0.3, 0.23]);
    }

    function addRover() {
      const x = -4.1, z = -1.35, y = terrainHeight(x, z);
      for (const wheelX of [x - 0.57, x + 0.57]) {
        for (const wheelZ of [z - 0.46, z + 0.46]) {
          cylinderBetween([wheelX - 0.13, y + 0.28, wheelZ], [wheelX + 0.13, y + 0.28, wheelZ], 0.23, [0.18, 0.19, 0.17], 12);
          for (let tread = 0; tread < 5; tread += 1) {
            const theta = tread * Math.PI * 2 / 5;
            const tx = wheelX, ty = y + 0.28 + Math.cos(theta) * 0.23, tz = wheelZ + Math.sin(theta) * 0.23;
            box(tx, ty, tz, 0.31, 0.045, 0.055, [0.43, 0.41, 0.36]);
          }
        }
      }
      box(x, y + 0.61, z, 1.52, 0.48, 1.0, [0.72, 0.69, 0.6]);
      box(x, y + 0.88, z - 0.04, 0.75, 0.2, 0.56, [0.28, 0.43, 0.48]);
      cylinderBetween([x - 0.13, y + 0.93, z], [x - 0.05, y + 1.8, z], 0.035, [0.66, 0.65, 0.56], 8);
      sphere(x - 0.05, y + 1.85, z, 0.16, [0.57, 0.65, 0.62], 6, 10, false);
      box(x + 0.7, y + 0.92, z, 0.32, 0.04, 0.23, [0.16, 0.3, 0.4]);
    }

    function addLander() {
      const x = -2.05, z = 1.1, y = terrainHeight(x, z);
      cylinder(x, y + 0.65, z, 0.55, 0.65, [0.72, 0.65, 0.51], 8);
      box(x, y + 1.03, z, 1.25, 0.16, 1.25, [0.81, 0.73, 0.58]);
      sphere(x, y + 1.26, z, 0.37, [0.49, 0.58, 0.58], 8, 12, false);
      for (let i = 0; i < 4; i += 1) {
        const angle = Math.PI / 4 + i * Math.PI / 2;
        const legX = x + Math.cos(angle) * 0.78, legZ = z + Math.sin(angle) * 0.78;
        cylinderBetween([x + Math.cos(angle) * 0.29, y + 0.48, z + Math.sin(angle) * 0.29], [legX, y + 0.08, legZ], 0.045, [0.63, 0.58, 0.48], 6);
        box(legX, y + 0.04, legZ, 0.28, 0.08, 0.2, [0.52, 0.47, 0.39]);
      }
    }

    function addCrew() {
      for (const [x, z, suit] of [[-0.65, -1.1, [0.79, 0.79, 0.68]], [0.25, -1.6, [0.67, 0.74, 0.61]], [2.4, -1.45, [0.82, 0.77, 0.66]], [3.2, -0.5, [0.68, 0.72, 0.6]]]) {
        const y = terrainHeight(x, z);
        box(x, y + 0.48, z, 0.22, 0.52, 0.2, suit);
        sphere(x, y + 0.85, z, 0.15, [0.57, 0.7, 0.72], 7, 10, false);
        box(x - 0.14, y + 0.21, z, 0.34, 0.09, 0.28, [0.25, 0.29, 0.27]);
      }
    }

    function addFlag() {
      const x = 3.8, z = -0.4, y = terrainHeight(x, z);
      cylinder(x, y + 0.72, z, 0.035, 1.44, [0.64, 0.62, 0.52], 7);
      box(x + 0.25, y + 1.12, z, 0.5, 0.3, 0.035, [0.72, 0.18, 0.13]);
      box(x, y + 0.04, z, 0.28, 0.08, 0.24, [0.45, 0.4, 0.33]);
    }

    addTerrain();
    addPerimeterFeatures();
    cylinder(0, terrainHeight(0, 0) + 0.018, 0, 2.3, 0.035, [0.55, 0.43, 0.32], 32);
    for (let i = 0; i < 40; i += 1) {
      const angle = i * 2.399963;
      const distance = 3.7 + (i % 7) * 0.9;
      const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
      const scale = 0.22 + ((i * 13) % 5) * 0.06;
      addRock(x, z, scale, i % 3 === 0 ? [0.41, 0.28, 0.21] : [0.53, 0.32, 0.22]);
    }
    addRover();
    addLander();
    if (mission.deployed.includes('habitat')) addHabitat();
    if (mission.deployed.includes('power')) {
      solarArray(-0.25, 3.2, 0.05);
      solarArray(2.5, 3.15, -0.06);
    }
    if (mission.deployed.includes('thermal')) {
      const x = 2.9, z = 1.2, y = terrainHeight(x, z);
      box(x, y + 0.48, z, 0.85, 0.82, 0.65, [0.61, 0.66, 0.62]);
      for (let i = -1; i <= 1; i += 1) box(x + i * 0.22, y + 0.94, z, 0.05, 0.1, 0.65, [0.24, 0.44, 0.5]);
    }
    if (mission.deployed.includes('water')) {
      const x = -0.4, z = 1.45, y = terrainHeight(x, z);
      for (let i = 0; i < 3; i += 1) {
        cylinder(x + i * 0.48, y + 0.4, z, 0.2, 0.77, [0.54, 0.68, 0.68], 12);
        sphere(x + i * 0.48, y + 0.79, z, 0.2, [0.65, 0.75, 0.72], 6, 12, false);
      }
    }
    if (mission.deployed.includes('greenhouse')) addGreenhouse();
    if (mission.deployed.includes('stormShelter')) addStormAnchors();
    if (mission.deployed.includes('radiationShield')) addRadiationShelter();
    if (mission.deployed.includes('iceDrill')) addIceDrill();
    if (mission.deployed.includes('fieldWorkshop')) addWorkshop();
    if (mission.deployed.includes('commsRelay')) addCommsRelay();
    if (mission.deployed.includes('medicalBay')) addMedicalBay();
    addFlag();
    if (mission.phase >= 2) addCrew();
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), vertexCount: positions.length / 3 };
  }

  let gl;
  let program;
  let geometry;
  let buffers;
  let uniforms;
  let signature = '';
  let yaw = 0.72;
  let pitch = 0.62;
  let distance = 14;
  let dragging = false;
  let previousPointer = null;
  let lastFrameTime = 0;
  let animationStarted = false;

  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' }) ||
      canvas.getContext('experimental-webgl', { alpha: true, antialias: true });
    if (!gl) throw new Error('WebGL is unavailable in this browser.');
    program = createProgram(gl);
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    buffers = {
      position: gl.createBuffer(),
      normal: gl.createBuffer(),
      color: gl.createBuffer()
    };
    uniforms = {
      viewProjection: gl.getUniformLocation(program, 'uViewProjection'),
      position: gl.getAttribLocation(program, 'aPosition'),
      normal: gl.getAttribLocation(program, 'aNormal'),
      color: gl.getAttribLocation(program, 'aColor')
    };
  } catch (error) {
    status.textContent = `3D view unavailable: ${error.message}`;
    status.classList.add('scene-error');
    status.style.opacity = '1';
    return;
  }

  function uploadGeometry(nextGeometry) {
    geometry = nextGeometry;
    for (const [key, values] of [['position', geometry.positions], ['normal', geometry.normals], ['color', geometry.colors]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[key]);
      gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
    }
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  function draw(time) {
    if (!geometry) {
      window.requestAnimationFrame(draw);
      return;
    }
    if (time - lastFrameTime > 32) {
      lastFrameTime = time;
      resize();
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const target = [0, 1.05, 0];
      const eye = [
        target[0] + distance * Math.sin(yaw) * Math.cos(pitch),
        target[1] + distance * Math.sin(pitch),
        target[2] + distance * Math.cos(yaw) * Math.cos(pitch)
      ];
      const projection = perspective(Math.PI / 4.1, canvas.width / canvas.height, 0.1, 100);
      gl.uniformMatrix4fv(uniforms.viewProjection, false, multiply(projection, lookAt(eye, target)));
      for (const [key, attribute] of [['position', uniforms.position], ['normal', uniforms.normal], ['color', uniforms.color]]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[key]);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, geometry.vertexCount);
    }
    window.requestAnimationFrame(draw);
  }

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    previousPointer = [event.clientX, event.clientY];
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging || !previousPointer) return;
    const dx = event.clientX - previousPointer[0], dy = event.clientY - previousPointer[1];
    yaw -= dx * 0.008;
    pitch = Math.max(0.18, Math.min(1.25, pitch + dy * 0.006));
    previousPointer = [event.clientX, event.clientY];
  });
  canvas.addEventListener('pointerup', () => { dragging = false; previousPointer = null; });
  canvas.addEventListener('pointercancel', () => { dragging = false; previousPointer = null; });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    distance = Math.max(8, Math.min(29, distance + event.deltaY * 0.012));
  }, { passive: false });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') yaw -= 0.12;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') yaw += 0.12;
    if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') pitch = Math.min(1.25, pitch + 0.08);
    if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') pitch = Math.max(0.18, pitch - 0.08);
  });

  window.MarsScene = {
    setMissionState(mission) {
      const nextSignature = JSON.stringify(mission);
      if (nextSignature === signature) return;
      signature = nextSignature;
      uploadGeometry(makeGeometry(mission));
      if (!animationStarted) {
        animationStarted = true;
        window.requestAnimationFrame(draw);
      }
      panel.classList.toggle('is-storm', ['STORM', 'SANDSTORM', 'WINDY'].includes(mission.dust));
      panel.classList.toggle('is-radiation', mission.radiation === 'ELEVATED');
      document.getElementById('world-sol').innerHTML = `SOL ${String(mission.sol).padStart(3, '0')} / ${String(mission.missionSols).padStart(3, '0')} <span>·</span> 18.4° N, 77.5° E`;
      status.textContent = '';
      status.classList.remove('scene-error');
    }
  };
})();
