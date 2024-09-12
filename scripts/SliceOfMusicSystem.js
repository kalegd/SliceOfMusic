/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as THREE from 'three';

const { Assets, ProjectHandler, PubSub, Scene, UserController, getDeviceType, isEditor } = window.DigitalBacon;
const { System } = Assets;
import { loadBeatmap } from 'http://localhost:8000/node_modules/bsmap/esm/beatmap/loader/_main.js';
const deviceType = getDeviceType();

const AUDIO_QUANTITY = 10;
const COMPONENT_ASSET_ID = 'b40ad677-1ec9-4ac0-9af6-8153a8b9f1e0';
const HJD_START = 4;
const HJD_MIN = .25;
const audioContext = new AudioContext();
const workingMatrix = new THREE.Matrix4();
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
            if(!(type in this._assets)) this._assets[type] = instance;
            if(type.endsWith('AUDIO')) this._createAudio(type);
            if(type == 'BLOCK') this._setupBlocks(instance);
        });
        PubSub.subscribe('SLICE_OF_MUSIC_SYSTEM', 'SLICE_OF_MUSIC:START',
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
        this._leftBlocks.frustumCulled = false;
        this._rightBlocks.frustumCulled = false;
        this._arrows.frustumCulled = false;
        this._circles.frustumCulled = false;

    }

    _setColor(side, hex) {
        this['_' + side + 'BlockMaterial'].color.setHex(hex);
        this['_' + side + 'BlockMaterial'].emissive.setHex(hex);
    }

    _startTrack(trackDetails) {
        //console.log(trackDetails);
        if(this._source) this._source.stop();
        let audio = trackDetails.data.audio;
        let buffer = audioContext.createBuffer(
            audio.channelData.length, audio.samplesDecoded,
            audio.sampleRate);
        for(let i = 0; i <  audio.channelData.length; i++) {
            buffer.copyToChannel(audio.channelData[i], i);
        }
        this._source = audioContext.createBufferSource();
        this._source.buffer = buffer;
        this._source.connect(audioContext.destination);
        //If we want to track playback position, look into this thread
        //https://github.com/WebAudio/web-audio-api/issues/2397
        let info = trackDetails.data.difficultyInfo[trackDetails.difficulty];
        let mapDetails =trackDetails.data.difficulties[trackDetails.difficulty];
        this._setupCourse(trackDetails, info, mapDetails);
        this._setColor('left', 0xff0000);
        this._setColor('right', 0x0000ff);
        Scene.object.add(this._course);
        console.log(info);
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
        this._colorNotesIndex = 0;
        this._course.position.set(GRID_DIMENSION * -1.5, this._playerHeight - GRID_DIMENSION * 2, 0);
        this._currentBeat = 0;
        this._leftBlocks.count = 0;
        this._rightBlocks.count = 0;
        this._arrows.count = 0;
        this._circles.count = 0;
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

    onAddToProject() {
        super.onAddToProject();
        this._addSubscriptions();
    }

    update(timeDelta) {
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

    static assetId = '98f2445f-df75-4ec6-82a0-7bb2cd23eb1c';
    static assetName = 'Slice of Music System';
}

ProjectHandler.registerAsset(SliceOfMusicSystem);
