/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const { Assets, EditorHelpers, ProjectHandler } = window.DigitalBacon;
const { AssetEntity, Component } = Assets;
const { ComponentHelper, EditorHelperFactory } = EditorHelpers;

export default class SliceOfMusicComponent extends Component {
    constructor(params = {}) {
        params['assetId'] = SliceOfMusicComponent.assetId;
        super(params);
        this._type = params['type'] || 'NORMAL';
    }

    _getDefaultName() {
        return SliceOfMusicComponent.assetName;
    }

    exportParams() {
        let params = super.exportParams();
        params['type'] = this._type;
        return params;
    }

    get type() { return this._type; }

    set type(type) { this._type = type; }

    supports(asset) {
        return asset instanceof AssetEntity;
    }

    static assetId = 'b40ad677-1ec9-4ac0-9af6-8153a8b9f1e0';
    static assetName = 'Slice of Music Component';
}

ProjectHandler.registerAsset(SliceOfMusicComponent);

if(EditorHelpers) {
    class SliceOfMusicComponentHelper extends ComponentHelper {
        constructor(asset) {
            super(asset);
        }

        static fields = [
            { "parameter": "type", "name": "Type",
                "map": { "Block": "BLOCK", "Saber": "SABER", "Bomb": "BOMB",
                    "Sliced Block Audio": "SLICED_BLOCK_AUDIO",
                    "Missed Block Audio": "MISSED_BLOCK_AUDIO",
                    "Sliced Bomb Audio": "SLICED_BOMB_AUDIO",
                },
                "type": ComponentHelper.FieldTypes.EnumField },
        ];
    }

    EditorHelperFactory.registerEditorHelper(SliceOfMusicComponentHelper,
        SliceOfMusicComponent);
}
