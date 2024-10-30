/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as OggVorbisDecoder from 'https://cdn.jsdelivr.net/npm/@wasm-audio-decoders/ogg-vorbis@0.1.15/dist/ogg-vorbis-decoder.min.js';
import { loadBeatmap } from 'bsmap';

const { BIG_BUTTON_STYLE, BIG_TEXT_STYLE, BODY_STYLE, ORBIT_DISABLING_STYLE, PAGE_STYLE, TEXT_STYLE, ZIP_CACHE } = await import(location.origin + '/scripts/constants.js');
const { createBackButton } = await import(location.origin + '/scripts/utils.js');
const { 'default': SearchPage } = await import(location.origin + '/scripts/SearchPage.js');
const { 'default': TrackPage } = await import(location.origin + '/scripts/TrackPage.js');

const { Assets, DigitalBaconUI, ProjectHandler, PubSub, getDeviceType } = window.DigitalBacon;
const { CustomAssetEntity } = Assets;
const deviceType = getDeviceType();
const DECODER = new window["ogg-vorbis-decoder"].OggVorbisDecoderWebWorker({ forceStereo: true });

class _SliceOfMusicMenu extends DigitalBaconUI.Body {
    constructor() {
        super(BODY_STYLE);
        this._searchPage = new SearchPage(this, PAGE_STYLE);
        this._trackPage = new TrackPage(() => {
            this.remove(this._trackPage);
            this.add(this._searchPage);
        }, PAGE_STYLE);
        this._createPleaseWaitPage();
        this._createFinishPage();
        this.add(this._searchPage);
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

    _createFinishPage() {
        this._scorePage = new DigitalBaconUI.Div(PAGE_STYLE, {
            justifyContent: 'spaceBetween',
            paddingBottom: 0.07,
        });
        let topRow = new DigitalBaconUI.Span({ width: '100%' });
        let backButton = createBackButton();
        backButton.onClick = () => {
            this.remove(this._scorePage);
            this.add(this._trackPage);
        };
        this._scoreTitle = new DigitalBaconUI.Text('Better luck next time',
            BIG_TEXT_STYLE, { width: 0.8 });
        this._rank = new DigitalBaconUI.Text('Rank: ', {
            color: 0xffffff,
            fontSize: 0.03,
        });
        this._score = new DigitalBaconUI.Text('Score: ', {
            color: 0xffffff,
            fontSize: 0.03,
        });
        this._notesHit = new DigitalBaconUI.Text('Notes Hit: ', {
            color: 0xffffff,
            fontSize: 0.03,
        });
        let details = new DigitalBaconUI.Div();
        let playAgainButton = new DigitalBaconUI.Div(ORBIT_DISABLING_STYLE,
            BIG_BUTTON_STYLE);
        this._playAgainButtonText = new DigitalBaconUI.Text('Try Again',
            BIG_TEXT_STYLE);
        playAgainButton.add(this._playAgainButtonText);
        playAgainButton.pointerInteractable.addHoveredCallback((hovered) => {
            playAgainButton.materialColor = (hovered) ? 0x444444 : 0x222222;
        });
        playAgainButton.onClick = () => this._trackPage.start();
        topRow.add(backButton);
        topRow.add(this._scoreTitle);
        details.add(this._rank);
        details.add(this._score);
        details.add(this._notesHit);
        this._scorePage.add(topRow);
        this._scorePage.add(details);
        this._scorePage.add(playAgainButton);
    }

    setScore(details) {
        let { score, rank, totalNotes, notesHit } = details;
        if(rank == 'F') {
            this._scoreTitle.text = 'Better luck next time';
            this._playAgainButtonText.text = 'Try Again';
        } else {
            this._scoreTitle.text = 'Nice job!';
            this._playAgainButtonText.text = 'Play Again';
        }
        this._rank.text = 'Rank: ' + rank;
        this._score.text = 'Score: ' + score;
        this._notesHit.text = 'Notes Hit: ' + notesHit + '/' + totalNotes;
        this.remove(this._trackPage);
        this.add(this._scorePage);
    }

    selectTrack(item) {
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
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:END', (details) => {
            this._menu.setScore(details);
            this.object.add(this._menu);
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
