// preload:用 contextBridge 安全地把 IPC 暴露給 renderer
import { contextBridge, ipcRenderer } from 'electron';

export interface GameApi {
  onStateUpdate: (cb: (snapshot: any) => void) => void;
  onOfflineReport: (cb: (report: any) => void) => void;
  allocateStat: (stat: string) => Promise<boolean>;
  respec: () => Promise<boolean>;
  selectMap: (level: number) => Promise<boolean>;
  selectArea: (areaIndex: number) => Promise<boolean>;
  setAutoBoss: (on: boolean) => Promise<boolean>;
  setLoopStage: (on: boolean) => Promise<boolean>;
  equip: (itemId: string) => Promise<boolean>;
  unequip: (slot: string) => Promise<boolean>;
  discard: (itemId: string) => Promise<boolean>;
  sell: (itemId: string) => Promise<number>;
  sellMany: (ids: string[]) => Promise<{ count: number; gold: number; skipped: number }>;
  discardMany: (ids: string[]) => Promise<{ count: number; skipped: number }>;
  toggleFavorite: (itemId: string) => Promise<boolean>;
  expandInventory: () => Promise<boolean>;
  craftInfo: (itemId: string) => Promise<any>;
  craft: (itemId: string, directive: 'prefix' | 'suffix' | null) => Promise<any>;
  useStone: (itemId: string, stoneId: string) => Promise<any>;
  setSkillSlot: (slot: number, skillId: string | null) => Promise<boolean>;
  devReset: () => Promise<boolean>;
  devClearInventory: () => Promise<boolean>;
  devSetExpMult: (v: number) => Promise<number>;
  devSetDropMult: (v: number) => Promise<number>;
  devSetInfiniteGold: (on: boolean) => Promise<boolean>;
  devSetInfiniteStones: (on: boolean) => Promise<boolean>;
  getState: () => Promise<any>;
  quit: () => void;
  openMain: () => void;
  closeMain: () => void;
}

const api: GameApi = {
  onStateUpdate: (cb) => {
    ipcRenderer.on('state:update', (_e, snapshot) => cb(snapshot));
  },
  onOfflineReport: (cb) => {
    ipcRenderer.on('offline:report', (_e, report) => cb(report));
  },
  allocateStat: (stat) => ipcRenderer.invoke('action:allocateStat', stat),
  respec: () => ipcRenderer.invoke('action:respec'),
  selectMap: (level) => ipcRenderer.invoke('action:selectMap', level),
  selectArea: (areaIndex) => ipcRenderer.invoke('action:selectArea', areaIndex),
  setAutoBoss: (on) => ipcRenderer.invoke('action:setAutoBoss', on),
  setLoopStage: (on) => ipcRenderer.invoke('action:setLoopStage', on),
  equip: (itemId) => ipcRenderer.invoke('action:equip', itemId),
  unequip: (slot) => ipcRenderer.invoke('action:unequip', slot),
  discard: (itemId) => ipcRenderer.invoke('action:discard', itemId),
  sell: (itemId) => ipcRenderer.invoke('action:sell', itemId),
  sellMany: (ids) => ipcRenderer.invoke('action:sellMany', ids),
  discardMany: (ids) => ipcRenderer.invoke('action:discardMany', ids),
  toggleFavorite: (itemId) => ipcRenderer.invoke('action:toggleFavorite', itemId),
  expandInventory: () => ipcRenderer.invoke('action:expandInventory'),
  craftInfo: (itemId) => ipcRenderer.invoke('action:craftInfo', itemId),
  craft: (itemId, directive) => ipcRenderer.invoke('action:craft', itemId, directive),
  useStone: (itemId, stoneId) => ipcRenderer.invoke('action:useStone', itemId, stoneId),
  setSkillSlot: (slot, skillId) => ipcRenderer.invoke('action:setSkillSlot', slot, skillId),
  devReset: () => ipcRenderer.invoke('dev:reset'),
  devClearInventory: () => ipcRenderer.invoke('dev:clearInventory'),
  devSetExpMult: (v) => ipcRenderer.invoke('dev:setExpMult', v),
  devSetDropMult: (v) => ipcRenderer.invoke('dev:setDropMult', v),
  devSetInfiniteGold: (on) => ipcRenderer.invoke('dev:setInfiniteGold', on),
  devSetInfiniteStones: (on) => ipcRenderer.invoke('dev:setInfiniteStones', on),
  getState: () => ipcRenderer.invoke('state:get'),
  quit: () => ipcRenderer.send('window:quit'),
  openMain: () => ipcRenderer.send('window:openMain'),
  closeMain: () => ipcRenderer.send('window:closeMain'),
};

contextBridge.exposeInMainWorld('game', api);
