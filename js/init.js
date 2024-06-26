


function main(container_id = 'container') {
	
	
	
	let new_canvas = document.createElement('canvas');
	let container = document.getElementById(container_id)
	canvas = container.appendChild(new_canvas);
	
	canvas.height = settings.canvas.height;
	canvas.width = settings.canvas.width;
		
    const gl = canvas.getContext('webgl2');
	gl.clientHeight = settings.canvas.height;
	gl.clientWidth = settings.canvas.width;	
	
	if (!gl) {
		return alert('sorry, need webgl2');
	};
	
	const ext = gl.getExtension('EXT_color_buffer_float');
    
	if (!ext) {
        return alert('sorry, need EXT_color_buffer_float');
    };

    const {
        width,
        height
    } = gl.canvas;

    const numParticles = settings.bugs.quantity;
    window.particleParameters = []; // info that does not change
    window.currentParticleState = []; // info that does change
    //window.nextParticleState = []; // computed from currentState

    for (let i = 0; i < numParticles; ++i) {
        particleParameters.push(rand(-10, 10), rand(-10, 10), 0, 0);
        currentParticleState.push(rand(0, width), rand(0, height), 0, 0);
    }

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    const particleParamsTex = twgl.createTexture(gl, {
        src: new Float32Array(particleParameters),
        internalFormat: gl.RGBA32F,
        width: numParticles,
        height: 1,
        minMax: gl.NEAREST,
    });
	
    const currentStateTex = twgl.createTexture(gl, {
        src: new Float32Array(currentParticleState),
        internalFormat: gl.RGBA32F,
        width: numParticles,
        height: 1,
        minMax: gl.NEAREST,
    });
	
    const nextStateTex = twgl.createTexture(gl, {
        internalFormat: gl.RGBA32F,
        width: numParticles,
        height: 1,
        minMax: gl.NEAREST,
    });

    // create a framebuffer with 1 attachment (currentStateTex)
    // and record that it's numParticles wide and 1 pixel tall
    let currentStateFBI = twgl.createFramebufferInfo(gl, [{
                    attachment: currentStateTex,
                },
            ], numParticles, 1);

    // create a framebuffer with 1 attachment (nextStateTex)
    // and record that it's numParticles wide and 1 pixel tall
    let nextStateFBI = twgl.createFramebufferInfo(gl, [{
                    attachment: nextStateTex,
                },
            ], numParticles, 1);

    const particleVS = `
	#version 300 es
	in vec4 position;
	void main() {
		gl_Position = position;
	}
  `;

    const particleFS = `
	#version 300 es
	precision highp float;

	uniform vec2 resolution;
	uniform float deltaTime;
	uniform sampler2D particleParamsTex;
	uniform sampler2D currentStateTex;

	out vec4 outColor;

	vec4 euclideanModulo(vec4 n, vec4 m) {
		return mod(mod(n, m) + m, m);
	}

	void main() {
		int i = int(gl_FragCoord.x);
		vec4 curPos = texelFetch(currentStateTex, ivec2(i, 0), 0);
		vec4 velocity = texelFetch(particleParamsTex, ivec2(i, 0), 0);

		outColor = euclideanModulo(curPos + velocity * deltaTime, vec4(resolution, 1, 1));
	}

  `;

    
	const drawVS = `
	#version 300 es
	uniform sampler2D currentStateTex;
	uniform vec2 resolution;
	void main() {
	gl_PointSize = 12.0;
	// we calculated pos in pixel coords 
	vec4 pos = texelFetch(currentStateTex, ivec2(gl_VertexID, 0), 0);
	gl_Position = vec4(
		pos.xy / resolution * 2. - 1.,  // convert to clip space
		0,
		1);
	}
	`;
	
	
    const drawFS = `
		#version 300 es
		
		precision mediump float;
		out vec4 outColor;
		
		void main() {
			
			float dist = (distance(vec2(0.5), gl_PointCoord));
			float dist_px = dist * 12.0;
			
			
			
			outColor.rgb = vec3(1, 1, 1) * max(0.0, 1.0-dist_px/12.0);
			
			outColor.a = 1.0;
			
		}
		
  `;

    // compile shaders, link program, look up locations.
    const particleProgramInfo = twgl.createProgramInfo(gl, [particleVS, particleFS]);
    const drawProgramInfo = twgl.createProgramInfo(gl, [drawVS, drawFS]);

    // create a -1 to +1 quad vertices and put in a buffer.
    const quadBufferInfo = twgl.primitives.createXYQuadBufferInfo(gl, 2);

    let then = 0;
    function render(now) {
        now *= 0.001; // convert to seconds
        const deltaTime = now - then;
        then = now;

        // bind the framebuffer and set the viewport to match
        twgl.bindFramebufferInfo(gl, nextStateFBI);
        gl.useProgram(particleProgramInfo.program);
        twgl.setBuffersAndAttributes(gl, particleProgramInfo, quadBufferInfo);
        twgl.setUniformsAndBindTextures(particleProgramInfo, {
            resolution: [width, height],
            deltaTime: deltaTime,
            currentStateTex: currentStateFBI.attachments[0],
            particleParamsTex,
        });
        // call drawArrays or drawBuffers
        twgl.drawBufferInfo(gl, quadBufferInfo);

        const t = nextStateFBI;
        nextStateFBI = currentStateFBI;
        currentStateFBI = t;

        // bind the canvas and set the viewport to match
        twgl.bindFramebufferInfo(gl, null);
        gl.useProgram(drawProgramInfo.program);
        twgl.setUniforms(drawProgramInfo, {
            resolution: [width, height],
            currentStateTex: currentStateFBI.attachments[0],
        });
        gl.drawArrays(gl.POINTS, 0, numParticles);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

main();