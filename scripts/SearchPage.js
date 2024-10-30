/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const { DigitalBaconUI, setKeyboardLock } = window.DigitalBacon;
const { API_URL, ORBIT_DISABLING_STYLE, TEXT_STYLE } = await import(location.origin + '/scripts/constants.js');

export default class SearchPage extends DigitalBaconUI.Div {
    constructor(menuController, ...styles) {
        super(...styles);
        this._trackSpans = [];
        this._requestNumber = 0;
        this._menuController = menuController;
        this._searchInput = new DigitalBaconUI.TextInput({
            borderRadius: 0.025,
            fontSize: 0.025,
            height: 0.05,
            marginBottom: 0.01,
            marginTop: 0.01,
            width: '90%',
        });
        this._searchInput.placeholder = 'Search';
        this._searchInput.pointerInteractable.hoveredCursor = 'text';
        this._searchInput.onEnter = () => this._searchInput.blur();
        this._searchInput.onFocus = () => setKeyboardLock(true);
        this._searchInput.onBlur = () => {
            setKeyboardLock(false);
            this._search(this._searchInput.value);
        };
        this._tracksDiv = new DigitalBaconUI.Div(ORBIT_DISABLING_STYLE, {
            height: 0.68,
            overflow: 'scroll',
            width: '100%',
        });
        this.add(this._searchInput);
        this.add(this._tracksDiv);
        this._search();
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
        span.onClick = () => this._menuController.selectTrack(item);
        span.pointerInteractable.addHoveredCallback((hovered) => {
            span.materialColor = (hovered) ? 0x222222 : 0x000000;
        });
        return span;
    }
}
