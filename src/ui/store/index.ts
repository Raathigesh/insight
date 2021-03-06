import { createContext } from 'react';
import debounce from 'lodash.debounce';
import { IndexerStatus } from './models/IndexerStatus';
import { PathMap } from './models/PathMap';
import { onSnapshot } from 'mobx-state-tree';
import {
    setPathMap,
    setBookmarksConfig,
    setPreference,
} from './services/config';
import { App } from './models/app';
import { listenToMessages } from 'ui/util/graphql';
import { getActiveSymbolForFile, getHistoryItems } from './services/file';
import Bookmarks from './models/bookmarks';
import { Preference } from './models/Preference';
import Workspace from './models/workspace';

const app = App.create({
    separator: '',
    root: '',
});
const pathMap = PathMap.create();
export const pathMapStore = createContext(pathMap);

const indexStatus = IndexerStatus.create(
    { status: 'none', indexedFiles: 0, totalFiles: 0 },
    { pathMap, app }
);

export const indexerStatusStore = createContext(indexStatus);
export const appStore = createContext(app);

const bookmarks = Bookmarks.create({ items: [] }, { indexStatus });
export const bookmarksStore = createContext(bookmarks);

onSnapshot(
    pathMap,
    debounce((newSnapshot: any) => {
        setPathMap(JSON.stringify(newSnapshot));
    }, 1000)
);

const workspace = Workspace.create({
    entries: [],
});
export const workspaceStore = createContext(workspace);

listenToMessages(async (event: string) => {
    if (event === 'waypoint.addSymbol') {
        const symbol = await getActiveSymbolForFile();
        bookmarks.addBookmark(symbol.name, symbol.filePath);
    } else if (event === 'waypoint.didChangeOpenTextDocuments') {
        // workspace.fetchOpenDocuments();
    } else if (event === 'waypoint.didChangeTextSelection') {
        const symbol = await getHistoryItems();
        workspace.setEntries(symbol);
    }
});

onSnapshot(bookmarks.items, () => {
    const items = bookmarks.getItemsForPersisting();
    setBookmarksConfig(items);
});

const preference = Preference.create({
    startIndexingOnStarUp: true,
});
export const preferenceStore = createContext(preference);

onSnapshot(preference, () => {
    const preferenceJSON = preference.getPersistableJson();
    setPreference(preferenceJSON);
});
