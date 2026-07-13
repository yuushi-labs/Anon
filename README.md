# Anon

**Anon** は、公開IDを使って会話を開始し、送信者を匿名ラベルで表示するDMアプリのプロトタイプです。クライアントはExpo / React Native、APIサーバーはExpress / tRPC、リアルタイム通信はSocket.IO、永続化はMySQL / Drizzle ORMで構成されています。

> **重要:** 現在の実装は開発途中です。暗号処理、API認可、WebSocket認証などに未解決の問題があるため、実在ユーザーのデータを扱う環境や本番環境へは公開しないでください。対応項目は[`todo.md`](todo.md)を参照してください。

## 現在の機能

アプリには、プロフィール登録、公開IDによるDM開始、会話一覧、チャット、ブロック、通報、プロフィール、設定の画面があります。サーバー側にはユーザー登録・ログイン・会話・メッセージ履歴・ブロック・通報・通知トークン登録のtRPC APIと、Socket.IOによるリアルタイムメッセージ配信の骨格があります。

| 領域           | 現在の実装                                          |
| -------------- | --------------------------------------------------- |
| ユーザー登録   | ユーザー名、公開ID、公開鍵、アイコンを登録          |
| ログイン       | タイムスタンプへの署名を検証し、JWTを発行する想定   |
| 会話           | 公開IDを指定して1対1の会話を作成                    |
| メッセージ     | 履歴をtRPCで取得し、新規メッセージをSocket.IOで配信 |
| 匿名表示       | 会話開始者を受信側で「匿名N」として表示する想定     |
| モデレーション | ユーザーのブロックとメッセージ通報                  |
| 通知           | Expo通知トークン取得とサーバー登録の骨格            |

現時点では**エンドツーエンド暗号化は実装されていません**。また、送信者の匿名性は画面表示上の仕組みであり、サーバー管理者やネットワーク上のあらゆる主体から身元を秘匿することを保証するものではありません。

## 技術スタック

| レイヤー         | 技術                                                     |
| ---------------- | -------------------------------------------------------- |
| クライアント     | React 19、React Native 0.81、Expo 54、Expo Router 6      |
| UI               | NativeWind、Tailwind CSS、React Native標準コンポーネント |
| API              | Node.js、Express 4、tRPC 11、Zod                         |
| リアルタイム通信 | Socket.IO 4                                              |
| データベース     | MySQL、Drizzle ORM、Drizzle Kit                          |
| クライアント状態 | React Context、TanStack Query                            |
| ローカル保存     | Expo SecureStore、AsyncStorage                           |
| テスト           | Vitest                                                   |
| パッケージ管理   | pnpm 9                                                   |

## アーキテクチャ

```mermaid
flowchart LR
    A[Expo / React Native Client] -->|tRPC over HTTP| B[Express API Server]
    A <-->|Socket.IO| C[Socket.IO Server]
    B --> D[(MySQL)]
    C --> D
    A --> E[Expo SecureStore]
    B -. notification integration .-> F[Push Provider]
```

通常のデータ取得と変更はtRPCを経由し、リアルタイムメッセージはSocket.IOで送受信します。ユーザー、会話、メッセージ、ブロック、通報はMySQLへ保存されます。秘密鍵などの端末固有情報はExpo SecureStoreへ保存する設計です。

## ディレクトリ構成

| パス                                 | 役割                                          |
| ------------------------------------ | --------------------------------------------- |
| [`app/`](app/)                       | Expo Routerの画面とナビゲーション             |
| [`components/`](components/)         | 共通UIコンポーネント                          |
| [`hooks/`](hooks/)                   | テーマや認証関連のReact Hooks                 |
| [`lib/`](lib/)                       | クライアント認証、暗号、通知、tRPC、Socket.IO |
| [`server/`](server/)                 | Express、tRPC、Socket.IO、DBアクセス          |
| [`server/routers/`](server/routers/) | 認証とDM機能のtRPCルーター                    |
| [`drizzle/`](drizzle/)               | DBスキーマ、リレーション、マイグレーション    |
| [`shared/`](shared/)                 | クライアントとサーバーの共有型・定数          |
| [`tests/`](tests/)                   | Vitestテスト                                  |
| [`assets/`](assets/)                 | アプリアイコンや画像                          |
| [`design.md`](design.md)             | 初期の画面・セキュリティ設計                  |
| [`todo.md`](todo.md)                 | 優先度付きの改善・修正計画                    |

## 前提条件

ローカル開発には、**Node.js 22前後**、**pnpm 9**、および接続可能な**MySQLデータベース**が必要です。AndroidまたはiOSのネイティブ確認を行う場合は、Expoの要件に加えてAndroid Studio、Xcode、またはExpo Goを利用できる環境を準備してください。

バージョンの大きな差による再現性低下を避けるため、依存関係は`pnpm-lock.yaml`を使ってインストールしてください。

## セットアップ

### 1. リポジトリを取得する

```bash
git clone https://github.com/yuushi2024/Anon.git
cd Anon
```

### 2. 依存関係をインストールする

```bash
corepack enable
pnpm install --frozen-lockfile
```

### 3. 環境変数を設定する

プロジェクトルートに`.env.local`ファイルを作成し、必要な環境変数を設定してください。`.env.example`を参考にしてください。

**サーバー起動スクリプトは`.env.local`ファイルを自動的に読み込みます。** ただし、`EXPO_PUBLIC_`で始まるクライアント側の環境変数は、Expoのビルドプロセスによって処理されるため、`.env.local`に記述するだけでなく、`app.json`や`eas.json`で設定するか、`expo start`コマンド実行時に直接渡す必要があります。

```bash
export DATABASE_URL='mysql://app_user:password@127.0.0.1:3306/anon'
export JWT_SECRET='replace-with-a-long-random-secret'
export EXPO_PUBLIC_API_BASE_URL='http://localhost:3000'
export PORT='3000'
```

| 変数                       |                 必須度 | 用途                                                            |
| -------------------------- | ---------------------: | --------------------------------------------------------------- |
| 変数                       |                 必須度 | 用途                                                            |
|---|---:|---|
| `DATABASE_URL`             |                   必須 | MySQLの接続文字列。DrizzleコマンドとAPIサーバーが使用           |
| `JWT_SECRET`               |                   必須 | JWT署名・Cookie関連の秘密値。本番では十分に長いランダム値を使用 |
| `EXPO_PUBLIC_API_BASE_URL` |                   推奨 | クライアントから接続するAPIサーバーのベースURL。例: `http://localhost:3000` |
| `PORT`                     |                   任意 | APIサーバーの希望ポート。指定しない場合、デフォルトは`3000`。 |
| `NODE_ENV`                 |                   任意 | `development`または`production`。 |
| `EXPO_PUBLIC_OAUTH_PORTAL_URL` | テンプレート機能使用時 | 既存OAuth機能のポータルURL。 |
| `EXPO_PUBLIC_OAUTH_SERVER_URL` | テンプレート機能使用時 | 既存OAuth機能のサーバーURL。 |
| `EXPO_PUBLIC_APP_ID`       | テンプレート機能使用時 | アプリケーションID。 |
| `EXPO_PUBLIC_OWNER_OPEN_ID`| テンプレート機能使用時 | オーナーのOpen ID。 |
| `EXPO_PUBLIC_OWNER_NAME`   | テンプレート機能使用時 | オーナー名。 |
| `BUILT_IN_FORGE_API_URL`   | テンプレート機能使用時 | 組み込み外部機能のAPI URL。 |
| `BUILT_IN_FORGE_API_KEY`   | テンプレート機能使用時 | 組み込み外部機能のAPIキー。 |

`EXPO_PUBLIC_`で始まる変数はクライアントバンドルから参照可能です。秘密鍵、DBパスワード、JWT秘密鍵などの機密情報には使用しないでください。

### 4. データベースを準備する

対象データベースを作成し、`DATABASE_URL`を設定したシェルでマイグレーションを実行します。

```bash
pnpm db:push
```

既存のマイグレーションには整理が必要な項目があります。新規環境へ適用する前に[`todo.md`](todo.md)の「データベース制約とクエリを改善する」を確認してください。

### 5. 開発サーバーを起動する

APIサーバーとExpo Web開発サーバーを同時に起動します。

```bash
pnpm dev
```

個別に起動する場合は、次のコマンドを別々のターミナルで実行します。

```bash
pnpm dev:server
pnpm dev:metro
```

既定ではAPIサーバーはポート`3000`、Expo Webはポート`8081`を使用します。APIサーバーは希望ポートが使用中の場合、後続の空きポートを選択します。その場合はクライアントの接続先も一致させる必要があります。

### 6. ネイティブ環境で起動する

```bash
pnpm android
pnpm ios
```

実機やエミュレーターから接続する場合、`localhost`は端末自身を指すことがあります。開発PCのLANアドレス、Androidエミュレーター向けホストアドレス、またはHTTPSで公開された開発URLを使ってAPI接続先を設定してください。現状のチャット画面にはSocket.IO接続先のハードコードが残っているため、ネイティブ検証前に[`todo.md`](todo.md)の接続先修正が必要です。

## 開発コマンド

### Android APKの作成方法

ExpoプロジェクトでAndroid APKを作成する最も推奨される方法は、**EAS Build** を利用することです。EAS Buildは、クラウド上でアプリのバイナリをビルドし、Google Play Storeへの提出準備ができた状態のAPKやAAB (Android App Bundle) を生成します。

1.  **EAS CLIのインストール**
    ```bash
    pnpm add -g eas-cli
    ```
2.  **Expoアカウントへのログイン**
    ```bash
    eas login
    ```
3.  **EAS Buildの設定**
    プロジェクトのルートで以下のコマンドを実行し、`eas.json`ファイルを生成・設定します。
    ```bash
    eas build:configure
    ```
    指示に従って設定を進めてください。
4.  **ビルドの実行**
    APKをビルドするには、以下のコマンドを実行します。
    ```bash
    eas build --platform android --profile production
    ```
    ビルドが完了すると、ExpoのダッシュボードからAPKファイルをダウンロードできます。

#### ローカルでのAPKビルド (Bare Workflow)

EAS Buildを使用せず、ローカル環境でAPKをビルドすることも可能です。この方法は、ネイティブコードのカスタマイズが必要な場合や、特定のビルド環境を制御したい場合に適しています。

1.  **ネイティブプロジェクトファイルの生成**
    ```bash
    pnpm expo prebuild
    ```
    これにより、`android/`ディレクトリが生成されます。
2.  **Android Studioでのビルド**
    生成された`android/`ディレクトリをAndroid Studioで開き、通常のAndroidプロジェクトとしてビルドします。`Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`を選択してください。

---

| コマンド          | 内容                                    |
| ----------------- | --------------------------------------- |
| `pnpm dev`        | APIサーバーとExpo Webを同時起動         |
| `pnpm dev:server` | APIサーバーを監視モードで起動           |
| `pnpm dev:metro`  | Expo Web開発サーバーを起動              |
| `pnpm android`    | Expo Android開発環境を起動              |
| `pnpm ios`        | Expo iOS開発環境を起動                  |
| `pnpm check`      | TypeScriptの型チェック                  |
| `pnpm lint`       | Expo ESLintを実行                       |
| `pnpm test`       | Vitestテストを実行                      |
| `pnpm build`      | APIサーバーを`dist/`へバンドル          |
| `pnpm start`      | ビルド済みAPIサーバーを本番モードで起動 |
| `pnpm db:push`    | Drizzleマイグレーションを生成・適用     |
| `pnpm format`     | Prettierでファイルを整形                |
| `pnpm qr`         | 開発URLのQRコードを生成                 |

## APIと通信フロー

### 登録とログイン

オンボーディング画面でユーザー名と公開IDを入力すると、クライアントが鍵ペアを生成・保存し、公開鍵を`dm.register`へ送信します。その後、タイムスタンプへの署名を`auth.login`へ渡し、成功時にJWTとユーザー情報を受け取る想定です。

現状のクライアント側暗号処理は本物のECDSA署名ではなく、サーバー側の検証方式と互換性がありません。このフローは設計上存在しますが、修正前は正常動作を保証できません。

### 会話とメッセージ

会話開始画面は相手の公開IDを`dm.startConversation`へ送り、会話IDを受け取ってチャット画面へ遷移します。履歴は`dm.getMessages`から取得し、新規メッセージはSocket.IOの`send_message`イベントで送信します。サーバーはDBへ保存した後、`conversation:{id}`ルームへ`message`イベントを配信します。

現在はHTTP APIとSocket.IOルームの認可が不十分です。参加者検証を実装するまでは、機密情報や個人情報を保存しないでください。

## データモデル

| テーブル        | 内容                                                     |
| --------------- | -------------------------------------------------------- |
| `users`         | テンプレート由来のOAuthユーザー                          |
| `app_users`     | 匿名DMアプリのプロフィール、公開ID、公開鍵、通知トークン |
| `conversations` | 会話開始者、受信者、匿名ラベル                           |
| `messages`      | 会話ID、送信者ID、本文、メッセージ種別                   |
| `blocks`        | ブロックしたユーザーと対象ユーザー                       |
| `reports`       | 通報者、対象メッセージ、理由、対応状態                   |

現在のスキーマでは一部の外部キー、重複防止制約、検索用インデックスが不足しています。本番データを投入する前にスキーマとマイグレーションを改善してください。

## テストと確認状況

リポジトリ確認時点で、次のコマンドは成功しています。

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

ただし、既存のテストファイルはskipされており、実際に実行されたテストケースはありません。型チェック成功は、認証・暗号・認可・画面操作の正しさを保証するものではありません。必要なテストは[`todo.md`](todo.md)にまとめています。

## セキュリティ上の既知の制約

| 項目             | 現状                            | 必要な対応                                 |
| ---------------- | ------------------------------- | ------------------------------------------ |
| クライアント署名 | 疑似鍵とSHA-256ダイジェスト     | 実際の署名アルゴリズムへ置換               |
| API認証          | 多くの手続きが`publicProcedure` | JWT検証済み手続きとリソース認可を追加      |
| WebSocket認証    | JWTの存在確認のみ               | 署名・期限を検証しJWTからユーザーを確定    |
| ルーム参加       | 会話参加者の確認なし            | 参加前にDBで認可                           |
| CORS             | 広い許可設定                    | 環境別の許可オリジンへ制限                 |
| 通知             | メモリ内キューの骨格            | 実際の通知プロバイダーとトークン管理を実装 |
| E2EE             | 未実装                          | 必要性と脅威モデルを定義して設計           |
| テスト           | 実行可能なテストなし            | セキュリティ・統合・UIテストを追加         |

脆弱性を発見した場合は、公開Issueへ秘密情報や再現用トークンを投稿せず、リポジトリ所有者へ非公開の方法で連絡してください。

## 開発方針

変更前に[`todo.md`](todo.md)で優先度と完了条件を確認し、特にP0のセキュリティ項目から対応してください。暗号や認証方式を変更するPull Requestでは、正常系だけでなく改ざん、期限切れ、権限外アクセス、再送などの異常系テストも同時に追加してください。

ドキュメントと実装が食い違った場合は、挙動を確認したうえで両方を同じPull Requestで更新してください。

## ライセンス

このリポジトリには、現時点でライセンスファイルが含まれていません。利用、配布、派生物の公開を行う前に、リポジトリ所有者がライセンス方針を決定してください。
