// 共用的 renderer 端全域型別:window.game 由 preload 經 contextBridge 暴露。
// 兩個 renderer(overlay / main)共用同一份,避免各自 declare 衝突。
import type { GameApi } from '../preload/preload';

declare global {
  interface Window {
    game: GameApi;
  }
}

export {};
