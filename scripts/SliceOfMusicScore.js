/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const { Assets, DigitalBaconUI, ProjectHandler, PubSub, THREE } = window.DigitalBacon;
const { CustomAssetEntity } = Assets;

const BODY_STYLE = new DigitalBaconUI.Style({
    alignItems: 'start',
    height: 0.05,
    materialColor: new THREE.Color(0xeeeeee),
    width: 1,
});
const TEXT_STYLE = new DigitalBaconUI.Style({
    color: 0xffffff,
    fontSize: 0.025,
});

class HealthBar extends DigitalBaconUI.Body {
    constructor() {
        super(BODY_STYLE);
        this._life = new DigitalBaconUI.Div({
            backgroundVisible: true,
            height: '100%',
            materialColor: new THREE.Color(0x00ff00),
            width: 0.5,
        });
        this.add(this._life);
    }

    setPercent(percent) {
        this._life.width = percent;
    }
}

export default class SliceOfMusicScore extends CustomAssetEntity {
    constructor(params = {}) {
        params['assetId'] = SliceOfMusicScore.assetId;
        super(params);
        this._scoreText = new DigitalBaconUI.Text('0', {
            color: 0xffffff,
            fontSize: 0.1,
        });
        this._multiplierText = new DigitalBaconUI.Text('1X', {
            color: 0xffffff,
            fontSize: 0.1,
        });
        this._scoreText.position.set(0, 0.01, -2.25);
        this._scoreText.rotation.set(-Math.PI / 2, 0, 0);
        this._multiplierText.position.set(-0.46, 0.01, -2.25);
        this._multiplierText.rotation.set(-Math.PI / 2, 0, 0);
        this._healthBar = new HealthBar();
        this._healthBar.position.set(0, 0.01, -2);
        this._healthBar.rotation.set(-Math.PI / 2, 0, 0);
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:START', () => {
            this._scoreText.text = '0';
            this._multiplierText.text = '1X';
            this._healthBar.setPercent(0.5);
            this.object.add(this._scoreText);
            this.object.add(this._multiplierText);
            this.object.add(this._healthBar);
        });
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:END', () => {
            this.object.remove(this._scoreText);
            this.object.remove(this._multiplierText);
            this.object.remove(this._healthBar);
        });
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:HEALTH', (healthPercent) => {
            this._healthBar.setPercent(healthPercent);
        });
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:SCORE', (score) => {
            this._scoreText.text = String(score);
        });
        PubSub.subscribe(this._id, 'SLICE_OF_MUSIC:MULTIPLIER', (multiplier) =>{
            this._multiplierText.text = multiplier + 'X';
        });
    }

    _getDefaultName() {
        return SliceOfMusicScore.assetName;
    }

    get description() { return "Score and Health for Slice of Music"; }

    static assetId = 'f4f94332-1568-4278-8c72-56f3627b32b7';
    static assetName = 'Slice of Music Score';
}

ProjectHandler.registerAsset(SliceOfMusicScore);
