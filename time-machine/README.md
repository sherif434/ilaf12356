# TIME MACHINE — Travel Through History

A static, Arabic-first, Three.js educational experience for exploring eight ancient civilizations and talking to fictional historical NPCs.

## Included civilizations
- Ancient Egypt
- Ancient Greece
- Ancient Rome
- Mesopotamia
- Ancient Persia (Achaemenid period)
- Indus Valley Civilization
- Ancient China
- Maya Civilization

## Run
Open \`index.html\` through a static web server or publish this folder with GitHub Pages. The project uses browser ES modules and an import map, so opening the file directly with \`file://\` is not recommended.

## Controls
- W / A / S / D: move the camera through the scene
- Mouse: look around (OrbitControls)
- Click a 3D character: start a conversation
- Civilization encyclopedia: open historical notes
- Return to portals: choose another civilization

## AI conversations
The optional AI model is \`onnx-community/Qwen2.5-0.5B-Instruct\`, loaded on demand through Transformers.js. It runs inference in the visitor's browser (WebGPU where available, WASM fallback). Model weights are downloaded from Hugging Face and cached by the browser. No API key is embedded and no chat backend is used. First load may require substantial bandwidth, memory, and time. If model loading fails, the curated offline knowledge dialogue remains available.

Model card: https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct  
Transformers.js: https://huggingface.co/docs/transformers.js

## Historical and visual accuracy
The 3D scenes and NPC bodies are generated procedurally with Three.js primitives. NPCs are fictional educational characters, not real historical people. The scenes are interpretive learning environments, not archaeologically exact reconstructions. Facts are concise introductions; dates and cultural phases can vary by scholarly periodization.

## Limitations of this static edition
GitHub Pages serves static files and cannot host a persistent AI inference server. This edition performs inference in the visitor's browser. For truly photorealistic rigged human models, voice conversations, persistent accounts, multiplayer, or shared world simulation, separately licensed 3D character assets and a backend service would be required.

## Credits and licenses
- Three.js: MIT License — https://github.com/mrdoob/three.js
- Transformers.js: Apache-2.0 — https://github.com/huggingface/transformers.js
- Qwen2.5-0.5B-Instruct: Apache-2.0 model family; review the model card before redistribution — https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct
