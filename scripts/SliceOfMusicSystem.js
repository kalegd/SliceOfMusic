/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as THREE from 'three';

const { Assets, AudioHandler, ProjectHandler, PubSub, Scene, UserController, getDeviceType, isEditor } = window.DigitalBacon;
const { System } = Assets;
import { loadBeatmap } from 'bsmap';
const deviceType = getDeviceType();

const AUDIO_QUANTITY = 10;
const COMPONENT_ASSET_ID = 'b40ad677-1ec9-4ac0-9af6-8153a8b9f1e0';
const HJD_START = 4;
const HJD_MIN = .25;
const workingMatrix = new THREE.Matrix4();
const workingVector3 = new THREE.Vector3();
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
        this._liveBlocks = new Set();
        this._playerHeight = 1.7;
        this._setupObstacles();
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
            this._leftBlockMaterial, 1000);
        this._rightBlocks = new THREE.InstancedMesh(cubeMesh.geometry,
            this._rightBlockMaterial, 1000);
        this._arrows = new THREE.InstancedMesh(arrowMesh.geometry,
            arrowMesh.material, 2000);
        this._circles = new THREE.InstancedMesh(circleMesh.geometry,
            circleMesh.material, 2000);
        this._course = new THREE.Object3D();
        this._course.add(this._leftBlocks);
        this._course.add(this._rightBlocks);
        this._course.add(this._arrows);
        this._course.add(this._circles);
        if(this._bombs) this._course.add(this._bombs);
        if(this._obstacles) this._course.add(this._obstacles);
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
        this._bombs = new THREE.InstancedMesh(mesh.geometry,mesh.material,1000);
        if(this._course) this._course.add(this._bombs);
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
        this._obstacles = new THREE.InstancedMesh(geometry, material, 1000);
        if(this._course) this._course.add(this._obstacles);
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
        let audioContext = AudioHandler.getListener().context;
        if(audioContext.state === 'interrupted') await audioContext.resume();
        let buffer = audioContext.createBuffer(
            audio.channelData.length, audio.samplesDecoded,
            audio.sampleRate);
        for(let i = 0; i <  audio.channelData.length; i++) {
            buffer.copyToChannel(audio.channelData[i], i);
        }
        this._source = audioContext.createBufferSource();
        this._source.buffer = buffer;
        this._source.connect(audioContext.destination);
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
        this._colorNotesIndex = 0;
        this._bombNotesIndex = 0;
        this._obstacleNotesIndex = 0;
        this._course.position.set(GRID_DIMENSION * -1.5, this._playerHeight - GRID_DIMENSION * 2, -0.5);
        this._currentBeat = 0;
        this._leftBlocks.count = 0;
        this._rightBlocks.count = 0;
        this._arrows.count = 0;
        this._circles.count = 0;
        this._bombs.count = 0;
        this._obstacles.count = 0;
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
            saber.rotation = [-90, 0, 0];
        }
        let bones = controller?._modelObject?.motionController?.bones;
        if(bones) {
            saber.object.position.addVectors(bones[6].position,
                bones[0].position).multiplyScalar(0.5);
            bones[6].getWorldPosition(workingVector3);
            saber.object.lookAt(workingVector3);
            saber.object.rotateX(Math.PI / 2);
        }
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
                let blocksIndex = blocks.count;
                let symbolsIndex = symbols.count;
                blocks.count++;
                symbols.count++;
                let time = note.time * 60 / this._bpm;
                let distance = -1 * this._noteJumpSpeed * time;
                workingMatrix.identity();
                workingMatrix.makeRotationZ(directionRotations[note.direction]);
                workingMatrix.setPosition(note.posX * GRID_DIMENSION,
                    note.posY * GRID_DIMENSION, distance);
                blocks.setMatrixAt(blocksIndex, workingMatrix);
                blocks.instanceMatrix.needsUpdate = true;
                symbols.setMatrixAt(symbolsIndex, workingMatrix);
                symbols.instanceMatrix.needsUpdate = true;
                this._colorNotesIndex++;
                this._liveBlocks.add({
                    blocks: blocks,
                    blocksIndex: blocksIndex,
                    symbols: symbols,
                    symbolsIndex: symbolsIndex,
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
                let blocksIndex = this._bombs.count;
                this._bombs.count++;
                let time = note.time * 60 / this._bpm;
                let distance = -1 * this._noteJumpSpeed * time;
                workingMatrix.identity();
                workingMatrix.setPosition(note.posX * GRID_DIMENSION,
                    note.posY * GRID_DIMENSION, distance);
                this._bombs.setMatrixAt(blocksIndex, workingMatrix);
                this._bombs.instanceMatrix.needsUpdate = true;
                this._bombNotesIndex++;
                this._liveBlocks.add({
                    blocks: this._bombs,
                    blocksIndex: blocksIndex,
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
                let blocksIndex = this._obstacles.count;
                this._obstacles.count++;
                let time = note.time * 60 / this._bpm;
                let distance = -1 * this._noteJumpSpeed * time;
                workingMatrix.identity();
                let depth = this._noteJumpSpeed * note.duration * 60 /this._bpm;
                distance -= (depth - 0.4) / 2;
                workingMatrix.makeScale(note.width, note.height, depth);
                workingMatrix.setPosition(note.posX * GRID_DIMENSION,
                    note.posY * GRID_DIMENSION, distance);
                this._obstacles.setMatrixAt(blocksIndex, workingMatrix);
                this._obstacles.instanceMatrix.needsUpdate = true;
                this._obstacleNotesIndex++;
                this._liveBlocks.add({
                    blocks: this._obstacles,
                    blocksIndex: blocksIndex,
                });
            } else {
                break;
            }
        }
    }

    update(timeDelta) {
        if(deviceType == 'XR') {
            this._controllerCheck('left');
            this._controllerCheck('right');
        }
        if(!this._trackStarted) {
            return;
        } else if(this._pendingAudioStart) {
            this._source.start();
            this._pendingAudioStart = false;
            timeDelta = 0;
        }
        this._course.position.z += this._noteJumpSpeed * timeDelta;
        this._currentBeat += timeDelta * this._bpm / 60;
        let maxBeat = this._currentBeat + this._halfJumpDuration;
        this._updateNotes(maxBeat);
        this._updateBombs(maxBeat);
        this._updateObstacles(maxBeat);
    }

    static assetId = '98f2445f-df75-4ec6-82a0-7bb2cd23eb1c';
    static assetName = 'Slice of Music System';
}

ProjectHandler.registerAsset(SliceOfMusicSystem);
