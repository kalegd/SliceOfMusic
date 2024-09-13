import { LibraryHandler, ProjectHandler, Scene } from 'DigitalBacon';

let assets = {};
let componentTypes = {
    block: 'BLOCK',
    //saber: 'SABER',
    //bomb: 'BOMB',
    //slicedAudio: 'SLICED_BLOCK_AUDIO',
    //missedAudio: 'MISSED_BLOCK_AUDIO',
    //slicedBombAudio: 'SLICED_BOMB_AUDIO',
};

function loadAsset(path, assetName, optionalParams) {
    return new Promise((resolve, reject) => {
        LibraryHandler.loadAsset(path, (assetId) => {
            assets[assetName] = ProjectHandler.addNewAsset(assetId,
                optionalParams);
            resolve(assetId);
        }, () => reject());
    });
}

function loadAssets() {
    let promises = [];
    promises.push(loadAsset('/models/block.glb', 'block'));
    promises.push(loadAsset('/scripts/SliceOfMusicMenu.js', 'menu',
        { position: [0, 1.5, -1] }));
    promises.push(loadAsset('/scripts/SliceOfMusicSystem.js', 'system'));
    Promise.all(promises).then(() => {
        LibraryHandler.loadAsset('/scripts/SliceOfMusicComponent.js',
            (assetId) => {
                configureAssets();
                for(let assetName in componentTypes) {
                    let component = ProjectHandler.addNewAsset(assetId,
                        { type: componentTypes[assetName] });
                    assets[assetName].addComponent(component.id);
                }
            });
    });
}

function configureAssets() {
    assets.block.object.traverse((node) => {
        if(node.name == 'Cube' && node.material.name == 'CubeMaterial') {
            node.material.emissiveIntensity = 0.3;
        }
    });
}

export default function main() {
    loadAssets();
    Scene.object.backgroundRotation.set(0, Math.PI, 0);

}