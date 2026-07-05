# Frontline Project Launcher - クロスプラットフォーム対応

このプロジェクトは Windows、macOS、Linux の3つのプラットフォームに対応しています。

## 修正内容

### 1. package.json の更新
- **prepackage スクリプト**: Windows 専用の PowerShell コマンドを、全プラットフォーム対応の `rm -rf release` に変更
- **ビルド設定の追加**:
  - `win`: Windows (NSIS + Portable)
  - `mac`: macOS (DMG + ZIP)
  - `linux`: Linux (AppImage + DEB)
- **プラットフォーム専用スクリプト**:
  - `npm run package:win` - Windows ビルド
  - `npm run package:mac` - macOS ビルド
  - `npm run package:linux` - Linux ビルド

### 2. electron/main.ts の更新

#### アイコンハンドリング
```typescript
function getIconPath(): string {
  if (process.platform === 'darwin') {
    return resolve(basePath, 'favicon.icns');  // macOS
  } else if (process.platform === 'linux') {
    return resolve(basePath, 'favicon.png');   // Linux
  } else {
    return resolve(basePath, 'favicon.ico');   // Windows
  }
}
```

#### Java 検索（クロスプラットフォーム対応）
`findBestJava()` 関数を全プラットフォーム対応にしました：
- **Windows**: `C:\Program Files\Java`, `~\AppData\...`
- **macOS**: `/Library/Java/JavaVirtualMachines`, `/opt/homebrew/opt/openjdk`
- **Linux**: `/usr/lib/jvm`, `/usr/java`, `/opt/java`
- **PATH 環境変数**: すべてのプラットフォームで検索

#### Java ランタイムダウンロード
`downloadJavaRuntime()` 関数を全プラットフォーム対応にしました：
- **Windows**: ZIP ファイルを自動抽出
- **macOS**: tar.gz をダウンロード（ARM64/x64 対応）
- **Linux**: tar.gz をダウンロード（ARM64/x64 対応）

### 3. プロトコルハンドラー
`app.whenReady()` 内の `local-file` プロトコルハンドラーは既にプラットフォーム別のパス処理に対応しています。

## ビルド方法

### 全プラットフォーム用ビルド
```bash
npm run package
```

### プラットフォーム別ビルド
```bash
# Windows
npm run package:win

# macOS
npm run package:mac

# Linux
npm run package:linux
```

## 必要なアイコンファイル

以下のアイコンファイルを `public/` フォルダに配置してください：

| ファイル | サイズ | プラットフォーム |
|---------|--------|-----------------|
| `favicon.ico` | 256x256px+ | Windows |
| `favicon.icns` | 512x512px+ | macOS |
| `favicon.png` | 512x512px+ | Linux |

## テスト方法

```bash
# 開発モード（全プラットフォーム）
bun run dev

# ビルド
bun run build

# パッケージング
npm run package
```

## 既知の制限

1. **macOS タイトルバーカスタマイズ**: `frame: false` は macOS で完全に機能しない場合があります
2. **Linux ディストロ**: 異なる Linux ディストロで追加の依存関係が必要な場合があります
3. **Java 自動ダウンロード**: 
   - Windows: 完全に自動化
   - macOS/Linux: tar.gz ダウンロード後、手動抽出またはシステム Java の使用を推奨

## 今後の改善

- [ ] macOS の `.icns` アイコン生成の自動化
- [ ] Linux の `.deb` パッケージ署名
- [ ] tar 抽出ライブラリの実装（macOS/Linux の Java 自動インストール）
- [ ] コード署名とノータライゼーション（macOS）
- [ ] Windows キャプション処理の改善
