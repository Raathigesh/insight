import { types, flow, Instance, onSnapshot, onPatch } from "mobx-state-tree";
import * as nanoid from "nanoid";
import { DocumentSymbol, Marker } from "./DocumentSymbol";
import { GqlSymbolInformation } from "entities/GqlSymbolInformation";
import { getMarkers, getCode } from "../services/search";
import { File } from "./File";
import { getFile } from "../services/file";
import { GqlFile } from "entities/GqlFile";
import { Note } from "./Note";
import { getStageConfig } from "../services/config";

export interface PersistableSymbol {
  name: string;
  path: string;
  x: number | undefined;
  y: number | undefined;
}

export interface PersistableStage {
  symbols: PersistableSymbol[];
}

export const DependencyGraph = types
  .model("DependencyGraph", {
    symbols: types.map(DocumentSymbol),
    files: types.map(File),
    notes: types.map(Note),
    colors: types.array(types.string),
    currentColorIndex: types.number,
    isBubbleDragging: types.boolean
  })
  .actions(self => {
    const initializeStage = flow(function*() {
      const config: PersistableStage | null = yield getStageConfig();
      if (config) {
        config.symbols.forEach(symbol =>
          setCurrentSymbol(symbol.name, symbol.path, {
            x: symbol.x,
            y: symbol.y
          })
        );
      }
    });

    const getNextColor = () => {
      const nextColor = self.colors[self.currentColorIndex];
      if (self.currentColorIndex === self.colors.length - 1) {
        self.currentColorIndex = 0;
      } else {
        self.currentColorIndex += 1;
      }
      return nextColor;
    };

    const setCurrentSymbol = flow(function*(
      name: string,
      filePath: string,
      attributes?: {
        x: number | undefined;
        y: number | undefined;
      }
    ) {
      const documentSymbol = DocumentSymbol.create({
        name,
        filePath
      });

      yield documentSymbol.fetchMarkers();
      yield documentSymbol.fetchCode();
      if (attributes) {
        documentSymbol.setPosition(attributes?.x || 0, attributes.y || 0);
      }
      self.symbols.set(documentSymbol.id, documentSymbol);
    });

    const addBubble = flow(function*(
      symbol: Instance<typeof DocumentSymbol>,
      line: number,
      column: number,
      x: number,
      y: number
    ) {
      const clickedMarker = symbol.markers.find(
        marker =>
          marker.location?.start.line === line &&
          marker.location.start.column <= column &&
          marker.location.end.column >= column
      );
      if (clickedMarker) {
        const nextColor = getNextColor();
        const id = symbol.id;
        clickedMarker.color = nextColor;

        const symbolForBubble = DocumentSymbol.create({
          name: clickedMarker.name,
          filePath: clickedMarker.filePath,
          createdForMarker: {
            markerId: clickedMarker.id,
            symbolId: id
          },
          color: nextColor,
          x,
          y
        });
        symbolForBubble.setPosition(x, y);
        yield symbolForBubble.fetchMarkers();
        yield symbolForBubble.fetchCode();
        self.symbols.set(symbolForBubble.id, symbolForBubble);
      }
    });

    const removeNode = (id: string) => {
      self.symbols.delete(id);
    };

    const removeFile = (path: string) => {
      self.files.delete(path);
    };

    const setIsBubbleDragging = (flag: boolean) => {
      self.isBubbleDragging = flag;
    };

    const moveSymbols = (deltaX: number, deltaY: number) => {
      [
        ...self.symbols.values(),
        ...self.files.values(),
        ...self.notes.values()
      ].forEach(symbol => {
        if (symbol) {
          const nextX = (symbol.tempX || 0) + deltaX;
          const nextY = (symbol.tempY || 0) + deltaY;
          (symbol.ref as any).current.style.transform = `translate(${nextX}px, ${nextY}px)`;
          symbol.tempX = nextX;
          symbol.tempY = nextY;
        }
      });
    };

    const finalizePosition = () => {
      self.symbols.forEach(symbol => {
        symbol.setPosition(symbol.tempX, symbol.tempY);
      });
    };

    const addFileMap = (gqlFile: GqlFile) => {
      self.files.set(
        gqlFile.filePath,
        File.create({
          filePath: gqlFile.filePath,
          symbols: gqlFile.symbols.map(symbol =>
            DocumentSymbol.create({
              name: symbol.name,
              filePath: symbol.filePath || "",
              kind: symbol.kind,
              location: {
                start: {
                  column: symbol?.location?.start?.column || 0,
                  line: symbol?.location?.start?.line || 0
                },
                end: {
                  column: symbol?.location?.end?.column || 0,
                  line: symbol?.location?.end?.line || 0
                }
              }
            })
          )
        })
      );
    };

    const addFile = flow(function*(filePath: string) {
      const gqlFile: GqlFile = yield getFile(filePath);
      addFileMap(gqlFile);
    });

    const addNote = () => {
      const id = nanoid();
      self.notes.set(id, Note.create({ id, x: 0, y: 0, color: "" }));
    };

    const removeNote = (id: string) => {
      self.notes.delete(id);
    };

    return {
      initializeStage,
      setCurrentSymbol,
      addBubble,
      removeNode,
      setIsBubbleDragging,
      moveSymbols,
      finalizePosition,
      addFile,
      removeFile,
      addFileMap,
      addNote,
      removeNote
    };
  })
  .views(self => ({
    getPersistableJSON(): PersistableStage {
      return {
        symbols: [...self.symbols.values()].map(symbol => ({
          name: symbol.name,
          path: symbol.filePath,
          x: symbol.x,
          y: symbol.y
        }))
      };
    }
  }));
