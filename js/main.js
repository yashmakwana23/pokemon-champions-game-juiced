// Bootstrap: register scenes, start the shared rAF loop, load save, go.
import { startLoop } from './engine/loop.js';
import { register, go } from './engine/scenes.js';
import { load } from './state/store.js';
import { initMobile } from './engine/mobile.js';

import { titleScene } from './scenes/title.js';
import { ftueScene } from './scenes/ftue.js';
import { hubScene } from './scenes/hub.js';
import { ranchScene } from './scenes/ranch.js';
import { trainingScene } from './scenes/training.js';
import { boxScene } from './scenes/box.js';
import { shopScene } from './scenes/shop.js';
import { missionsScene } from './scenes/missions.js';
import { battleSelectScene } from './scenes/battle-select.js';
import { battleScene } from './scenes/battle.js';
import { resultsScene } from './scenes/results.js';

register('title', titleScene);
register('ftue', ftueScene);
register('hub', hubScene);
register('ranch', ranchScene);
register('training', trainingScene);
register('box', boxScene);
register('shop', shopScene);
register('missions', missionsScene);
register('battle-select', battleSelectScene);
register('battle', battleScene);
register('results', resultsScene);

startLoop();
load();
go('title');
initMobile();
