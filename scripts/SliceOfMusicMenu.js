/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as THREE from 'three';
import * as OggVorbisDecoder from 'https://cdn.jsdelivr.net/npm/@wasm-audio-decoders/ogg-vorbis@0.1.15/dist/ogg-vorbis-decoder.min.js';
import { loadBeatmap } from 'bsmap';

const { Assets, DigitalBaconUI, OrbitDisablingPointerInteractable, ProjectHandler, PubSub, getDeviceType, setKeyboardLock } = window.DigitalBacon;
const { CustomAssetEntity } = Assets;
const deviceType = getDeviceType();
const DECODER = new window["ogg-vorbis-decoder"].OggVorbisDecoderWebWorker({ forceStereo: true });

const BODY_STYLE = new DigitalBaconUI.Style({
    borderRadius: 0.01,
    borderWidth: 0.001,
    height: 0.75,
    materialColor: new THREE.Color(0x000000),
    opacity: 1,
    width: 1,
});
const TEXT_STYLE = new DigitalBaconUI.Style({
    color: 0xffffff,
    fontSize: 0.025,
});
const BIG_TEXT_STYLE = new DigitalBaconUI.Style({
    color: 0xffffff,
    fontSize: 0.05,
});
const BIG_BUTTON_STYLE = new DigitalBaconUI.Style({
    backgroundVisible: true,
    borderRadius: 0.05,
    height: 0.1,
    justifyContent: 'center',
    materialColor: 0x222222,
    width: 0.4,
});
const ORBIT_DISABLING_STYLE = new DigitalBaconUI.Style({
    pointerInteractableClassOverride: OrbitDisablingPointerInteractable,
});
const PAGE_STYLE = new DigitalBaconUI.Style({ height: '100%', width: '99%' });
const API_URL = 'https://api.beatsaver.com';
const ZIP_CACHE = {};

function createBackButton() {
    let backButton = new DigitalBaconUI.Div(ORBIT_DISABLING_STYLE, {
        backgroundVisible: true,
        borderRadius: 0.01,
        materialColor: 0x222222,
        margin: 0.02,
        width: 0.06,
    });
    backButton.add(new DigitalBaconUI.Text('<', BIG_TEXT_STYLE));
    backButton.pointerInteractable.addHoveredCallback((hovered) => {
        backButton.materialColor = (hovered) ? 0x444444 : 0x222222;
    });
    return backButton;
}

class TrackPage extends DigitalBaconUI.Div {
    constructor(backHandler, ...styles) {
        super(...styles);
        let topRow = new DigitalBaconUI.Span({ width: '100%' });
        let backButton = createBackButton();
        backButton.onClick = () => backHandler();
        this._title = new DigitalBaconUI.Text('', {
            color: 0xffffff,
            fontSize: 0.05,
            textAlign: 'center',
            width: 0.8,
        });
        this.add(topRow);
        topRow.add(backButton);
        topRow.add(this._title);
        this._difficulties = [];
        this._difficultyDiv = new DigitalBaconUI.Div({
            alignItems: 'start',
            height: 0.475,
            width: '50%',
        });
        this.add(this._difficultyDiv);
        this._startButton = new DigitalBaconUI.Div(ORBIT_DISABLING_STYLE,
            BIG_BUTTON_STYLE);
        this.add(this._startButton);
        this._startButton.add(new DigitalBaconUI.Text('Start', BIG_TEXT_STYLE));
        this._startButton.pointerInteractable.addHoveredCallback((hovered) => {
            this._startButton.materialColor = (hovered) ? 0x444444 : 0x222222;
        });
        this._startButton.onClick = () => this.start();
    }

    setTrack(track) {
        this._startButton.pointerInteractable.disabled = true;
        this._clear();
        this._title.text = track.name;
        this._data = ZIP_CACHE[track.id];
        for(let key in this._data.difficulties) {
            let radio = new DigitalBaconUI.Radio('difficulty', {
                height: 0.04,
                margin: 0.005,
                width: 0.04,
            }, ORBIT_DISABLING_STYLE);
            let radioSpan = new DigitalBaconUI.Span();
            let radioLabel = new DigitalBaconUI.Text(key, TEXT_STYLE);
            radioSpan.add(radio);
            radioSpan.add(radioLabel);
            this._difficultyDiv.add(radioSpan);
            this._difficulties.push(radioSpan);
            radio.onSelect = () => {
                this._chosenDifficulty = key;
                this._startButton.pointerInteractable.disabled = false;
            };
        }
    }

    _clear() {
        for(let radioSpan of this._difficulties) {
            this._difficultyDiv.remove(radioSpan);
        }
        this._difficulties = [];
    }

    start() {
        console.log("Start game");
        PubSub.publish('SLICE_OF_MUSIC_TRACK_PAGE', 'SLICE_OF_MUSIC:START', {
            data: this._data,
            difficulty: this._chosenDifficulty,
        });
    }
}

class _SliceOfMusicMenu extends DigitalBaconUI.Body {
    constructor() {
        super(BODY_STYLE);
        this._searchInput = new DigitalBaconUI.TextInput({
            borderRadius: 0.025,
            fontSize: 0.025,
            height: 0.05,
            marginBottom: 0.01,
            marginTop: 0.01,
            width: '90%',
        });
        this._searchPage = new DigitalBaconUI.Div(PAGE_STYLE);
        this._trackPage = new TrackPage(() => {
            this.remove(this._trackPage);
            this.add(this._searchPage);
        }, PAGE_STYLE);
        this._createPleaseWaitPage();
        this._createLosePage();
        this._tracksDiv = new DigitalBaconUI.Div(ORBIT_DISABLING_STYLE, {
            height: 0.68,
            overflow: 'scroll',
            width: '100%',
        });
        this._trackSpans = [];
        this._searchInput.placeholder = 'Search';
        this._searchInput.pointerInteractable.hoveredCursor = 'text';
        this._searchInput.onEnter = () => this._searchInput.blur();
        this._searchInput.onFocus = () => setKeyboardLock(true);
        this._searchInput.onBlur = () => {
            setKeyboardLock(false);
            this._search(this._searchInput.value);
        };
        this.add(this._searchPage);
        this._searchPage.add(this._searchInput);
        this._searchPage.add(this._tracksDiv);
        this._requestNumber = 0;
        this._search();
        if(deviceType == 'XR') this.onClick = () => {};
    }

    _createPleaseWaitPage() {
        this._pleaseWaitPage = new DigitalBaconUI.Div(PAGE_STYLE);
        let pleaseWaitText = new DigitalBaconUI.Text('Please wait...', {
            color: 0xffffff,
            height: '100%',
            fontSize: 0.05,
        });
        this._pleaseWaitPage.add(pleaseWaitText);
    }

    _createLosePage() {
        this._losePage = new DigitalBaconUI.Div(PAGE_STYLE, {
            justifyContent: 'spaceBetween',
            paddingBottom: 0.07,
        });
        let topRow = new DigitalBaconUI.Span({ width: '100%' });
        let backButton = createBackButton();
        backButton.onClick = () => {
            this.remove(this._losePage);
            this.add(this._trackPage);
        };
        let loseTitle = new DigitalBaconUI.Text('Better luck next time',
            BIG_TEXT_STYLE, { width: 0.8 });
        this._loseScore = new DigitalBaconUI.Text('Score: ', {
            color: 0xffffff,
            fontSize: 0.03,
        });
        let options = new DigitalBaconUI.Span();
        let tryAgainButton = new DigitalBaconUI.Div(ORBIT_DISABLING_STYLE,
            BIG_BUTTON_STYLE);
        tryAgainButton.add(new DigitalBaconUI.Text('Try Again',BIG_TEXT_STYLE));
        tryAgainButton.pointerInteractable.addHoveredCallback((hovered) => {
            tryAgainButton.materialColor = (hovered) ? 0x444444 : 0x222222;
        });
        tryAgainButton.onClick = () => this._trackPage.start();
        topRow.add(backButton);
        topRow.add(loseTitle);
        this._losePage.add(topRow);
        this._losePage.add(this._loseScore);
        this._losePage.add(tryAgainButton);
    }

    lose(score) {
        this._loseScore.text = 'Score: ' + score;
        this.remove(this._trackPage);
        this.add(this._losePage);
    }

    _search(text) {
        this._requestNumber++;
        let requestNumber = this._requestNumber;
        let url = API_URL + '/search/text/0?leaderboard=All&';
        url += (text)
            ? 'sortOrder=Relevance&q=' + encodeURIComponent(text)
            : 'sortOrder=Latest';
        fetch(url, {
            method: "GET",
        }).then((result) => result.json()).then((response) => {
            if(this._requestNumber != requestNumber) return;
            this._displayResults(response.docs);
        }).catch((err) => {
            console.error('Something went wrong when trying to fetch latest playlists');
            console.error(err);
            //TODO: Let user know there was an error
        });
    }

    _displayResults(results) {
        this._clearSearch();
        for(let item of results) {
            let trackSpan = this._createTrackSpan(item);
            this._tracksDiv.add(trackSpan);
            this._trackSpans.push(trackSpan);
        }
    }

    _clearSearch() {
        for(let span of this._trackSpans) {
            this._tracksDiv.remove(span);
        }
        this._trackSpans = [];
    }

    _createTrackSpan(item) {
        let span = new DigitalBaconUI.Span(ORBIT_DISABLING_STYLE, {
            alignItems: 'start',
            backgroundVisible: true,
            height: 0.15,
            materialColor: 0x000000,
            padding: 0.01,
            width:'100%',
        });
        let div = new DigitalBaconUI.Div({
            alignItems: 'start',
            height: '100%',
            padding: 0.01,
            width:'100%',
        });
        let albumImage = new DigitalBaconUI.Image(item.versions[0].coverURL,
            { height: '100%' });
        let titleText = new DigitalBaconUI.Text(item.name, TEXT_STYLE);
        let artistText = new DigitalBaconUI.Text(item.uploader.name,TEXT_STYLE);
        let difficulties = item.versions[0].diffs
            .map((diff) => diff.difficulty)
            .filter((value, index, array) => array.indexOf(value) === index)
            .join(' | ');
        let difficultiesText = new DigitalBaconUI.Text(difficulties,TEXT_STYLE);
        div.add(titleText);
        div.add(artistText);
        div.add(difficultiesText);
        span.add(albumImage);
        span.add(div);
        span.onClick = () => this._select(item);
        span.pointerInteractable.addHoveredCallback((hovered) => {
            span.materialColor = (hovered) ? 0x222222 : 0x000000;
        });
        return span;
    }

    _select(item) {
        this.remove(this._searchPage);
        if(ZIP_CACHE[item.id]) {
            this.add(this._trackPage);
            this._trackPage.setTrack(item);
        } else {
            this.add(this._pleaseWaitPage);
            JSZipUtils.getBinaryContent(item.versions[0].downloadURL,
                (err, data) => {
                    if(err) {
                        console.error(err);
                        this.remove(this._pleaseWaitPage);
                        this.add(this._searchPage);
                        return;
                    }
                    JSZip.loadAsync(data).then((jsZip) => {
                        try {
                            this._loadZip('Info.dat', item, jsZip);
                        } catch(err) {
                            this._loadZip('info.dat', item, jsZip);
                        }
                    }).catch((err) => {
                        console.error(err);
                        this.remove(this._pleaseWaitPage);
                        this.add(this._searchPage);
                    });
            });
        }
    }

    _loadZip(infoDatFilename, item, jsZip) {
        let itemData = { difficulties: {}, difficultyInfo: {} };
        let promises = [];
        jsZip.file(infoDatFilename).async("string").then((info) => {
            info = JSON.parse(info);
            info = loadBeatmap('info', info);
            itemData.info = info;
            let difficulties = [];
            for(let difficulty of info.difficulties) {
                let characteristic = difficulty.characteristic;
                let name = characteristic + ' ' + difficulty.difficulty;
                itemData.difficultyInfo[name] = difficulty;
                promises.push(jsZip.file(difficulty.filename)
                    .async('string').then((difficultyInfo) => {
                        difficultyInfo = JSON.parse(difficultyInfo);
                        itemData.difficulties[name] = loadBeatmap('difficulty',
                            difficultyInfo);
                    }));
            }
            promises.push(jsZip.file(info.audio.filename).async('uint8array')
                .then((audio) => DECODER.decodeFile(audio))
                .then((audio) => {
                    itemData.audio = audio;
                    return DECODER.reset();
                }));
            Promise.all(promises).then(() => {
                ZIP_CACHE[item.id] = itemData;
                this.remove(this._pleaseWaitPage);
                this.add(this._trackPage);
                this._trackPage.setTrack(item);
            }).catch((err) => {
                console.error(err);
                this.remove(this._pleaseWaitPage);
                this.add(this._searchPage);
            });
        });
    }
}

export default class SliceOfMusicMenu extends CustomAssetEntity {
    constructor(params = {}) {
        params['assetId'] = SliceOfMusicMenu.assetId;
        super(params);
        this._menu = new _SliceOfMusicMenu();
        this.object.add(this._menu);
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:START', () => {
            this.object.remove(this._menu);
        });
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:END', () => {
            this.object.add(this._menu);
        });
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:LOSE', (score) => {
            this._menu.lose(score);
        });
    }

    _getDefaultName() {
        return SliceOfMusicMenu.assetName;
    }

    get description() { return "Menu for Slice of Music"; }

    static assetId = '6529282d-8c64-46b0-9746-dc4a9a8687d2';
    static assetName = 'Slice of Music Menu';
}

ProjectHandler.registerAsset(SliceOfMusicMenu);
