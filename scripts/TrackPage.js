/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const { DigitalBaconUI, OrbitDisablingPointerInteractable, PubSub } = window.DigitalBacon;
const { BIG_BUTTON_STYLE, BIG_TEXT_STYLE, ORBIT_DISABLING_STYLE, TEXT_STYLE, ZIP_CACHE } = await import(location.origin + '/scripts/constants.js');
const { createBackButton } = await import(location.origin + '/scripts/utils.js');

const greenText = new DigitalBaconUI.Style({ color: 0x00ff00 });

export default class TrackPage extends DigitalBaconUI.Div {
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
            overflow: 'scroll',
            width: '50%',
        }, ORBIT_DISABLING_STYLE);
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
            let span = new DigitalBaconUI.Span({
                backgroundVisible: true,
                materialColor: 0x000000,
                padding: 0.02,
                width: '100%',
            }, ORBIT_DISABLING_STYLE);
            let label = new DigitalBaconUI.Text(key, TEXT_STYLE);
            span.add(label);
            span.textComponent = label;
            this._difficultyDiv.add(span);
            this._difficulties.push(span);
            span.pointerInteractable.addHoveredCallback((hovered) => {
                span.materialColor = (hovered) ? 0x222222 : 0x000000;
            });
            span.onClick = () => {
                for(let difficulty of this._difficulties) {
                    difficulty.textComponent.removeStyle(greenText);
                }
                label.addStyle(greenText);
                this._chosenDifficulty = key;
                this._startButton.pointerInteractable.disabled = false;
            };
        }
    }

    _clear() {
        for(let span of this._difficulties) {
            this._difficultyDiv.remove(span);
        }
        this._difficulties = [];
    }

    start() {
        //console.log("Start game");
        PubSub.publish('SLICE_OF_MUSIC_TRACK_PAGE', 'SLICE_OF_MUSIC:START', {
            data: this._data,
            difficulty: this._chosenDifficulty,
        });
    }
}
