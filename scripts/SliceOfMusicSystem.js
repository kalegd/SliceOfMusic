/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as THREE from 'three';
import * as OggVorbisDecoder from 'https://cdn.jsdelivr.net/npm/@wasm-audio-decoders/ogg-vorbis@0.1.15/dist/ogg-vorbis-decoder.min.js';

const { Assets, AudioHandler, DigitalBaconUI, ProjectHandler, PubSub, Scene, UserController, getDeviceType, isEditor } = window.DigitalBacon;
const { System } = Assets;
const { InputHandler } = DigitalBaconUI;
import { loadBeatmap } from 'bsmap';
const deviceType = getDeviceType();
const DECODER = new window["ogg-vorbis-decoder"].OggVorbisDecoder({ forceStereo: true });

const AUDIO_QUANTITY = 10;
const COMPONENT_ASSET_ID = 'b40ad677-1ec9-4ac0-9af6-8153a8b9f1e0';
const HJD_START = 4;
const HJD_MIN = .25;
const workingMatrix = new THREE.Matrix4();
const workingVector3 = new THREE.Vector3();
const raycaster = new THREE.Raycaster(undefined, undefined, 0, 1);
const GRID_DIMENSION = 0.45;
const directionRotations = [
    Math.PI,
    0,
    Math.PI * 3 / 2,
    Math.PI / 2,
    Math.PI * 5 / 4,
    Math.PI * 3 / 4,
    Math.PI * 7 / 4,
    Math.PI / 4,
    0,
];

export default class SliceOfMusicSystem extends System {
    constructor(params = {}) {
        params['assetId'] = SliceOfMusicSystem.assetId;
        super(params);
        this._assets = {};
        this._audioAssets = {
            SLICED_BLOCK_AUDIO: [],
            MISSED_BLOCK_AUDIO: [],
            SLICED_BOMB_AUDIO: [],
        };
        this._audioIndexes = {
            SLICED_BLOCK_AUDIO: 0,
            MISSED_BLOCK_AUDIO: 0,
            SLICED_BOMB_AUDIO: 0,
        };
        this._playerHeight = 1.7;
        this._setupHitBoxes();
        this._setupObstacles();
        this._setupAudios();
        this._rotationReads = 0;
    }

    _getDefaultName() {
        return SliceOfMusicSystem.assetName;
    }

    get description() { return "Controller for Slice of Music"; }

    _addSubscriptions() {
        if(isEditor()) return;
        this._listenForComponentAttached(COMPONENT_ASSET_ID, (message) => {
            let instance = ProjectHandler.getSessionAsset(message.id);
            let component = ProjectHandler.getSessionAsset(message.componentId);
            let type = component.type;
            if(type in this._assets) return;
            this._assets[type] = instance;
            if(type.endsWith('AUDIO')) this._createAudio(type);
            if(type == 'BLOCK') this._setupBlocks(instance);
            if(type == 'BOMB') this._setupBombs(instance);
            if(type == 'SABER') this._setupSabers(instance);
        });
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:START',
            (trackDetails) => this._startTrack(trackDetails));
    }

    _createAudio(type) {
        if(this._audioAssets[type].length > 0) return;
        let audio = this._assets[type];
        if(!audio) return;
        for(let i = 0; i < AUDIO_QUANTITY; i++) {
            let clonedAudio = audio.clone();
            this._audioAssets[type].push(clonedAudio);
        }
        this._audioIndexex[type] = 0;
    }

    _setupBlocks(instance) {
        let cubeMesh, arrowMesh, circleMesh;
        instance.object.traverse((node) => {
            if(node instanceof THREE.Mesh) {
                if(node.name == 'Cube') cubeMesh = node;
                else if(node.name == 'Arrow') arrowMesh = node;
                else if(node.name == 'Circle') circleMesh = node;
            }
        });
        this._rightBlockMaterial = cubeMesh.material;
        this._leftBlockMaterial = cubeMesh.material.clone();
        this._leftBlocks = new THREE.InstancedMesh(cubeMesh.geometry,
            this._leftBlockMaterial, 200);
        this._rightBlocks = new THREE.InstancedMesh(cubeMesh.geometry,
            this._rightBlockMaterial, 200);
        this._arrows = new THREE.InstancedMesh(arrowMesh.geometry,
            arrowMesh.material, 400);
        this._circles = new THREE.InstancedMesh(circleMesh.geometry,
            circleMesh.material, 400);
        this._course = new THREE.Object3D();
        this._course.add(this._leftBlocks);
        this._course.add(this._rightBlocks);
        this._course.add(this._arrows);
        this._course.add(this._circles);
        if(this._bombs) this._course.add(this._bombs);
        if(this._obstacles) this._course.add(this._obstacles);
        this._leftBlocks.maxCount = 200;
        this._rightBlocks.maxCount = 200;
        this._arrows.maxCount = 400;
        this._circles.maxCount = 400;
        this._leftBlocks.frustumCulled = false;
        this._rightBlocks.frustumCulled = false;
        this._arrows.frustumCulled = false;
        this._circles.frustumCulled = false;
    }

    _setupBombs(instance) {
        let mesh;
        instance.object.traverse((node) => {
            if(node instanceof THREE.Mesh) mesh = node;
        });
        this._bombs = new THREE.InstancedMesh(mesh.geometry,mesh.material, 200);
        if(this._course) this._course.add(this._bombs);
        this._bombs.maxCount = 200;
        this._bombs.frustumCulled = false;
    }

    _setupObstacles() {
        let geometry = new THREE.BoxGeometry(GRID_DIMENSION, GRID_DIMENSION,
            GRID_DIMENSION);
        let material = new THREE.MeshLambertMaterial({
            color: 0xffff00,
            opacity: 0.5,
            side: THREE.DoubleSide,
            transparent: true,
        });
        this._obstacles = new THREE.InstancedMesh(geometry, material, 200);
        if(this._course) this._course.add(this._obstacles);
        this._obstacles.maxCount = 200;
        this._obstacles.frustumCulled = false;
    }

    _setupSabers(instance) {
        this._rightSaber = instance;
        this._leftSaber = instance.clone(true);
        this._rightSaber.position = [1, 1, -1];
        this._leftSaber.position = [-1, 1, -1];
        for(let child of this._rightSaber.children) {
            if(child.name == 'Saber Blade') {
                this._rightSaberMaterial = ProjectHandler.getAsset(
                    child.materialId);
                let params = this._rightSaberMaterial.exportParams();
                delete params.id;
                this._leftSaberMaterial = ProjectHandler.addNewAsset(
                    this._rightSaberMaterial.assetId, params);
            }
        }
        for(let child of this._leftSaber.children) {
            child.materialId = this._leftSaberMaterial.id;
            for(let child2 of child.children) {
                if(child2.name == 'Saber Tip')
                    child2.materialId = this._leftSaberMaterial.id;
            }
        }
        this._rightSaber.object.traverse((node) => {
            node.renderOrder = 5;
        });
        this._leftSaber.object.traverse((node) => {
            node.renderOrder = 5;
        });
        this._rightSaber.rotations = [];
        this._rightSaber.tip = new THREE.Object3D();
        this._rightSaber.tip.position.set(0, 1, 0);
        this._rightSaber.tip.lastPosition = new THREE.Vector3();
        this._rightSaber.tip.direction = new THREE.Vector3();
        this._rightSaber.object.add(this._rightSaber.tip);
        this._leftSaber.rotations = [];
        this._leftSaber.tip = new THREE.Object3D();
        this._leftSaber.tip.position.set(0, 1, 0);
        this._leftSaber.tip.lastPosition = new THREE.Vector3();
        this._leftSaber.tip.direction = new THREE.Vector3();
        this._leftSaber.object.add(this._leftSaber.tip);
    }

    _setupHitBoxes() {
        let material = new THREE.MeshBasicMaterial({
            opacity: 0.25,
            side: THREE.DoubleSide,
            transparent: true,
        });
        let geometry = new THREE.BoxGeometry(0.5, 0.5, 0.9);
        geometry.translate(0, 0, 0.15);
        this._hitBox = new THREE.Mesh(geometry, material);
        geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        this._smallHitBox = new THREE.Mesh(geometry, material);
        geometry = new THREE.SphereGeometry(0.2);
        this._hitSphere = new THREE.Mesh(geometry, material);
        this._hitBox.visible = false;
        this._smallHitBox.visible = false;
        this._hitSphere.visible = false;
        Scene.object.add(this._hitBox);
        Scene.object.add(this._smallHitBox);
        Scene.object.add(this._hitSphere);
    }

    async _setupAudios(url) {
        this._audioContext = AudioHandler.getListener().context;
        this._hitAudio = await this._setupAudio('/assets/audio/HitSound.ogg');
        this._missAudio = await this._setupAudio('/assets/audio/MissSound.ogg');
        this._badHitAudio = await this._setupAudio(
            '/assets/audio/BadHitSound.ogg');
    }

    async _setupAudio(url) {
        let response = await fetch(url);
        let audio = await response.arrayBuffer();
        audio = new Uint8Array(audio);
        await DECODER.ready;
        audio = await DECODER.decode(audio);
        await DECODER.reset();
        let buffer = this._audioContext.createBuffer(
            audio.channelData.length, audio.samplesDecoded,
            audio.sampleRate);
        for(let i = 0; i <  audio.channelData.length; i++) {
            buffer.copyToChannel(audio.channelData[i], i);
        }
        return buffer;
    }

    _setColor(side, hex) {
        this['_' + side + 'BlockMaterial'].color.setHex(hex);
        this['_' + side + 'BlockMaterial'].emissive.setHex(hex);
        this['_' + side + 'SaberMaterial'].color = hex;
    }

    async _startTrack(trackDetails) {
        //console.log(trackDetails);
        if(this._source) this._source.stop();
        let audio = trackDetails.data.audio;
        if(this._audioContext.state === 'interrupted')
            await this._audioContext.resume();
        let buffer = this._audioContext.createBuffer(
            audio.channelData.length, audio.samplesDecoded,
            audio.sampleRate);
        for(let i = 0; i <  audio.channelData.length; i++) {
            buffer.copyToChannel(audio.channelData[i], i);
        }
        this._source = this._audioContext.createBufferSource();
        this._source.buffer = buffer;
        this._source.connect(this._audioContext.destination);
        this._source.onended = () => this._onTrackFinished();
        //If we want to track playback position, look into this thread
        //https://github.com/WebAudio/web-audio-api/issues/2397
        let info = trackDetails.data.difficultyInfo[trackDetails.difficulty];
        let mapDetails =trackDetails.data.difficulties[trackDetails.difficulty];
        this._setupCourse(trackDetails, info, mapDetails);
        this._setColor('left', 0xff00ff);
        this._setColor('right', 0x00ffff);
        Scene.object.add(this._course);
        //console.log(info);
        console.log(mapDetails);
    }

    _setupCourse(trackDetails, info, mapDetails) {
        this._bpm = trackDetails.data.info.audio.bpm;
        this._noteJumpSpeed = info.njs;
        this._startBeatOffset = info.njsOffset;
        this._halfJumpDuration = this._calculateHalfJumpDistance(this._bpm,
            this._noteJumpSpeed, this._startBeatOffset);
        this._jumpDistance = this._calculateJumpDistance(this._bpm,
            this._noteJumpSpeed, this._halfJumpDuration);
        this._colorNotes = mapDetails.difficulty.colorNotes;
        this._bombNotes = mapDetails.difficulty.bombNotes;
        this._obstacleNotes = mapDetails.difficulty.obstacles;
        this._bpmEvents = mapDetails.difficulty.bpmEvents || [];
        while(this._bpmEvents.length && this._bpmEvents[0].time == 0) {
            this._bpm = this._bpmEvents[0].bpm;
            this._bpmEvents.shift();
        }
        this._originalBpm = this._bpm;
        this._colorNotesIndex = 0;
        this._bombNotesIndex = 0;
        this._obstacleNotesIndex = 0;
        this._bpmEventsIndex = 0;
        this._collisionsIndex = 0;
        this._liveBlocks = [];
        this._liveObstacles = [];
        this._course.position.set(GRID_DIMENSION * -1.5, this._playerHeight - GRID_DIMENSION * 2, -1.5);
        this._currentBeat = 0;
        this._leftBlocks.count = 0;
        this._rightBlocks.count = 0;
        this._arrows.count = 0;
        this._circles.count = 0;
        this._bombs.count = 0;
        this._obstacles.count = 0;
        this._leftBlocks.counter = 0;
        this._rightBlocks.counter = 0;
        this._arrows.counter = 0;
        this._circles.counter = 0;
        this._bombs.counter = 0;
        this._obstacles.counter = 0;
        this._rotationReads = 0;
        this._pendingAudioStart = true;
        this._trackStarted = true;
    }

    //https://github.com/KivalEvan/BeatSaber-MappingUtility/blob/main/src/bsmap/beatmap/helpers/njs.ts#L64-L72
    _calculateHalfJumpDistance(bpm, njs, offset) {
        let maxHalfJump = 17.999;
        let num = 60 / bpm;
        let hjd = HJD_START;
        while(njs * num * hjd > maxHalfJump) hjd /= 2;
        if(hjd < 1) hjd = 1;
        return Math.max(hjd + offset, HJD_MIN);
    }

    //https://github.com/KivalEvan/BeatSaber-MappingUtility/blob/main/src/bsmap/beatmap/helpers/njs.ts#L103-L105
    _calculateJumpDistance(bpm, njs, hjd) {
        return njs * (60 / bpm) * hjd * 2;
    }

    _onTrackFinished() {
        this._trackStarted = false;
        PubSub.publish(this._id, 'SLICE_OF_MUSIC:END', {});
    }

    onAddToProject() {
        super.onAddToProject();
        this._addSubscriptions();
    }

    _controllerCheck(side) {
        let saber = this['_' + side + 'Saber'];
        if(!saber) return;
        side = side.toUpperCase();
        let controller = UserController.getController(side);
        if(!controller?.object.parent) controller =UserController.getHand(side);
        if(!this._trackStarted) {
            if(saber.parent) saber.parentId = null;
            if(controller?._modelObject && !controller._modelObject.visible)
                controller._modelObject.visible = true;
            return;
        } else if(controller?._modelObject?.visible) {
            controller._modelObject.visible = false;
        }
        if(saber.parent != controller) {
            saber.parentId = controller?.id;
            saber.position = [0, 0, 0];
            saber.rotation = [Math.PI / -2, 0, 0];
            if(controller?.constructor?.name == 'XRController') {
                let gamepad = InputHandler.getXRGamepad(side);
                if(gamepad && gamepad.hapticActuators)
                    saber.hapticActuators = gamepad.hapticActuators;
            } else {
                delete saber.hapticActuators;
            }
        }
        let bones = controller?._modelObject?.motionController?.bones;
        if(bones) {
            saber.object.position.addVectors(bones[6].position,
                bones[0].position).multiplyScalar(0.5);
            bones[6].getWorldPosition(workingVector3);
            saber.object.lookAt(workingVector3);
            saber.object.rotateX(Math.PI / 2);
        }
        if(this._rotationReads % 3 == 0)
            saber.rotations.push(saber.object.rotation.toArray());
        saber.object.updateMatrixWorld(true);
        saber.tip.getWorldPosition(workingVector3);
        saber.tip.direction.subVectors(workingVector3, saber.tip.lastPosition);
        saber.tip.lastPosition.copy(workingVector3);
    }

    _checkCollisions() {
        while(this._liveBlocks.length && this._getZ(this._liveBlocks[0]) > 2) {
            let details = this._liveBlocks[0];
            workingMatrix.makeTranslation(0, -1000, 0);
            details.blocks.setMatrixAt(details.blocksIndex, workingMatrix);
            details.blocks.instanceMatrix.needsUpdate = true;
            if(!details.isBomb) {
                details.symbols.setMatrixAt(details.symbolsIndex,workingMatrix);
                details.symbols.instanceMatrix.needsUpdate = true;
            }
            this._liveBlocks.shift();
            this._collisionsIndex = Math.max(0, this._collisionsIndex - 1);
        }
        while(this._liveObstacles.length
                && this._getZ(this._liveObstacles[0]) > 2) {
            let details = this._liveObstacles[0];
            workingMatrix.makeTranslation(0, -1000, 0);
            details.blocks.setMatrixAt(details.blocksIndex, workingMatrix);
            details.blocks.instanceMatrix.needsUpdate = true;
            this._liveObstacles.shift();
        }

        for(let i = this._collisionsIndex; i < this._liveBlocks.length; i++) {
            let details = this._liveBlocks[i];
            let z = this._getZ(details);
            if(z < -2) return;
            if(details.passed) continue;
            if(z > 0.5) {
                this._miss(details);
            } else {
                if(!this._checkSaberCollision('right', details))
                    this._checkSaberCollision('left', details);
            }
        }
    }

    _checkSaberCollision(side, details) {
        let saber = this['_' + side + 'Saber'];
        if(!saber || !saber.parent) return;
        let hitObject = (details.isBomb)
            ? this._hitSphere
            : (details.side != side) ? this._smallHitBox : this._hitBox;
        details.blocks.getMatrixAt(details.blocksIndex, workingMatrix);
        workingVector3.setFromMatrixPosition(workingMatrix);
        workingVector3.add(this._course.position);
        hitObject.position.copy(workingVector3);
        hitObject.rotation.setFromRotationMatrix(workingMatrix);
        saber.object.getWorldPosition(workingVector3);
        raycaster.ray.origin.copy(workingVector3);
        raycaster.ray.direction.copy(
            workingVector3.sub(saber.tip.lastPosition).negate());
        let intersections = raycaster.intersectObject(hitObject);
        if(intersections.length == 0) return false;
        let point = hitObject.worldToLocal(intersections[0].point);
        if(details.isBomb) {
            this._hitBomb(details);
        } else if(details.side != side) {
            this._badHit(details, saber);
        } else if(details.isAnyDirection) {
            this._hitBlock(details, saber);
        } else {
            //Check direction
            workingVector3.copy(saber.tip.direction);
            workingVector3.add(hitObject.position);
            hitObject.worldToLocal(workingVector3);
            if(workingVector3.y < 0) {
                this._hitBlock(details, saber);
            } else {
                this._smallHitBox.position.copy(this._hitBox.position);
                this._smallHitBox.rotation.copy(this._hitBox.rotation);
                intersections = raycaster.intersectObject(this._smallHitBox);
                if(intersections.length == 0) return false;
                this._badHit(details, saber);
            }
        }
        return true;
    }

    _getZ(details) {
        details.blocks.getMatrixAt(details.blocksIndex, workingMatrix);
        workingVector3.setFromMatrixPosition(workingMatrix);
        workingVector3.add(this._course.position);
        let z = workingVector3.z;
        if(details.depth) z -= details.depth / 2;
        return z;
    }

    _miss(details) {
        details.passed = true;
        if(details.isBomb) return;
        let source = this._audioContext.createBufferSource();
        source.buffer = this._missAudio;
        source.connect(this._audioContext.destination);
        source.start();
        //TODO: Update score/multiplier
    }

    _hitBomb(details) {
        details.passed = true;
        let source = this._audioContext.createBufferSource();
        source.buffer = this._badHitAudio;
        source.connect(this._audioContext.destination);
        source.start();
        //TODO: Update score/multiplier
        let hapticActuators = saber.hapticActuators;
        if(!hapticActuators || hapticActuators.length == 0) return;
        hapticActuators[0].pulse(.75, 100);
    }

    _badHit(details, saber) {
        details.passed = true;
        let source = this._audioContext.createBufferSource();
        source.buffer = this._badHitAudio;
        source.connect(this._audioContext.destination);
        source.start();
        //TODO: Update score/multiplier
    }

    _hitBlock(details, saber) {
        details.passed = true;
        workingMatrix.makeTranslation(0, -1000, 0);
        details.blocks.setMatrixAt(details.blocksIndex, workingMatrix);
        details.blocks.instanceMatrix.needsUpdate = true;
        details.symbols.setMatrixAt(details.symbolsIndex, workingMatrix);
        details.symbols.instanceMatrix.needsUpdate = true;
        let source = this._audioContext.createBufferSource();
        source.buffer = this._hitAudio;
        source.connect(this._audioContext.destination);
        source.start(0, 0.18);
        //TODO: Update score/multiplier
        let hapticActuators = saber.hapticActuators;
        if(!hapticActuators || hapticActuators.length == 0) return;
        hapticActuators[0].pulse(.25, 100);

    }

    _updateNotes(maxBeat) {
        while(this._colorNotesIndex < this._colorNotes.length) {
            let note = this._colorNotes[this._colorNotesIndex];
            if(note.time < maxBeat) {
                let blocks = (note.color == 0)
                    ? this._leftBlocks
                    : this._rightBlocks;
                let symbols = (note.direction == 8)
                    ? this._circles
                    : this._arrows;
                let blocksIndex = blocks.counter % blocks.maxCount;
                let symbolsIndex = symbols.counter % symbols.maxCount;
                blocks.counter++;
                symbols.counter++;
                blocks.count = Math.min(blocks.counter, blocks.maxCount);
                symbols.count = Math.min(symbols.counter, symbols.maxCount);
                let distance = this._getNoteDistance(note.time);
                workingMatrix.identity();
                workingMatrix.makeRotationZ(directionRotations[note.direction]);
                workingMatrix.setPosition(note.posX * GRID_DIMENSION,
                    note.posY * GRID_DIMENSION, distance);
                blocks.setMatrixAt(blocksIndex, workingMatrix);
                blocks.instanceMatrix.needsUpdate = true;
                symbols.setMatrixAt(symbolsIndex, workingMatrix);
                symbols.instanceMatrix.needsUpdate = true;
                this._colorNotesIndex++;
                this._liveBlocks.push({
                    blocks: blocks,
                    blocksIndex: blocksIndex,
                    symbols: symbols,
                    symbolsIndex: symbolsIndex,
                    isAnyDirection: note.direction == 8,
                    side: (note.color == 0) ? 'left' : 'right',
                });
            } else {
                break;
            }
        }
    }

    _updateBombs(maxBeat) {
        while(this._bombNotesIndex < this._bombNotes.length) {
            let note = this._bombNotes[this._bombNotesIndex];
            if(note.time < maxBeat) {
                let blocksIndex = this._bombs.counter;
                this._bombs.counter++;
                this._bombs.count = Math.min(this._bombs.counter,
                    this._bombs.maxCount);
                let distance = this._getNoteDistance(note.time);
                workingMatrix.identity();
                workingMatrix.setPosition(note.posX * GRID_DIMENSION,
                    note.posY * GRID_DIMENSION, distance);
                this._bombs.setMatrixAt(blocksIndex, workingMatrix);
                this._bombs.instanceMatrix.needsUpdate = true;
                this._bombNotesIndex++;
                this._liveBlocks.push({
                    blocks: this._bombs,
                    blocksIndex: blocksIndex,
                    isBomb: true,
                });
            } else {
                break;
            }
        }
    }

    _updateObstacles(maxBeat) {
        while(this._obstacleNotesIndex < this._obstacleNotes.length) {
            let note = this._obstacleNotes[this._obstacleNotesIndex];
            if(note.time < maxBeat) {
                let blocksIndex = this._obstacles.counter;
                this._obstacles.counter++;
                this._obstacles.count = Math.min(this._obstacles.counter,
                    this._obstacles.maxCount);
                let distance = this._getNoteDistance(note.time);
                workingMatrix.identity();
                let depth = this._noteJumpSpeed * note.duration * 60
                    / this._bpm;
                distance -= (depth - GRID_DIMENSION) / 2;
                workingMatrix.makeScale(note.width, note.height,
                    depth / GRID_DIMENSION);
                workingMatrix.setPosition(note.posX * GRID_DIMENSION,
                    note.posY * GRID_DIMENSION, distance);
                this._obstacles.setMatrixAt(blocksIndex, workingMatrix);
                this._obstacles.instanceMatrix.needsUpdate = true;
                this._obstacleNotesIndex++;
                this._liveObstacles.push({
                    blocks: this._obstacles,
                    blocksIndex: blocksIndex,
                    depth: depth,
                });
            } else {
                break;
            }
        }
    }

    _getNoteDistance(beat) {
        if(!this._bpmEvents.length) {
            let time = beat * 60 / this._originalBpm;
            return -1 * this._noteJumpSpeed * time;
        } else {
            let currentBeat = 0;
            let currentDistance = 0;
            let currentBpm = this._originalBpm;
            for(let i = 0; i < this._bpmEvents.length; i++) {
                let bpmEvent = this._bpmEvents[i];
                if(bpmEvent.time >= beat) {
                    break;
                } else {
                    let time = (bpmEvent.time - currentBeat) * 60 / currentBpm;
                    currentDistance -= this._noteJumpSpeed * time;
                    currentBpm = bpmEvent.bpm;
                    currentBeat = bpmEvent.time;
                }
            }
            let time = (beat - currentBeat) * 60 / currentBpm;
            currentDistance -= this._noteJumpSpeed * time;
            return currentDistance;
        }
    }

    _updatePositions() {
        let maxBeat = this._currentBeat + this._halfJumpDuration;
        this._updateNotes(maxBeat);
        this._updateBombs(maxBeat);
        this._updateObstacles(maxBeat);
    }

    update(timeDelta) {
        if(deviceType == 'XR') {
            this._controllerCheck('left');
            this._controllerCheck('right');
            this._rotationReads++;
        }
        if(!this._trackStarted) {
            return;
        } else if(this._pendingAudioStart) {
            this._source.start();
            this._pendingAudioStart = false;
            timeDelta = 0;
        }
        this._course.position.z += this._noteJumpSpeed * timeDelta;
        let currentBeat = this._currentBeat + timeDelta * this._bpm / 60;
        while(this._bpmEventsIndex < this._bpmEvents.length) {
            let bpmEvent = this._bpmEvents[this._bpmEventsIndex];
            if(bpmEvent.time >= currentBeat) break;
            currentBeat = this._currentBeat;
            this._currentBeat = bpmEvent.time;
            this._updatePositions();
            timeDelta -= (this._currentBeat - currentBeat) * 60 / this._bpm;
            currentBeat = this._currentBeat + timeDelta * this._bpm / 60;
            this._bpm = bpmEvent.bpm;
            this._bpmEventsIndex++;
        }
        this._currentBeat = currentBeat;
        this._updatePositions();
        this._checkCollisions();
    }

    static assetId = '98f2445f-df75-4ec6-82a0-7bb2cd23eb1c';
    static assetName = 'Slice of Music System';
}

ProjectHandler.registerAsset(SliceOfMusicSystem);
