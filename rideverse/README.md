# RIDEVERSE MVP — 「世界に一人だけのヴェリアを生成する体験」

Expo (React Native + TypeScript) + Supabase + OpenAI API による、RIDEVERSE の最小体験実装。

スコープは依頼書のとおり、以下の7画面のみ:

Splash → Welcome → Bike登録 → 質問 → AI生成演出 → 名前入力 → プロフィール

GPS・ライド記録・育成・写真・地図・日記・通知・ログインボーナス・ランキングは未実装（意図的にスコープ外）。

## セットアップ

```bash
cd rideverse
npm install
cp .env.example .env   # 値を埋める
npm start
```

`api/rideverse/*.js` を Vercel などにデプロイし、`.env` の `EXPO_PUBLIC_API_BASE_URL` にそのデプロイ先を設定してください（OpenAI の API キーはクライアントに一切含めず、サーバー側の環境変数 `OPENAI_API_KEY` としてのみ保持します）。

Supabase 側は `supabase/schema.sql` を SQL Editor で実行し、`bike-photos` / `veria-images` の Storage バケットを作成してください（詳細はファイル内コメント参照）。

## ディレクトリ構成（Feature First）

```
rideverse/
  App.tsx, index.ts                  エントリポイント
  src/
    app/RootNavigator.tsx            画面遷移（1本道のスタック）
    context/GenerationSessionContext.tsx  Bike〜Profileで共有するウィザード状態
    theme/                           白基調 + チェレステブルーのデザイントークン
    components/                      画面横断の共通UI（Button, ScreenContainer）
    config/appConfig.ts              クライアント向け非機密設定
    types/veria.ts                   ヴェリアのドメイン型
    features/
      splash/ welcome/               世界観・導入
      bike/                          撮影・選択 + AI Vision解析 + 手動修正フォーム
      questions/                     config/questions.config.ts で質問を増減可能
      generation/                    演出(GenerationAnimation)とAI呼び出し(useVeriaGeneration)を分離
      naming/                        AI候補は参考表示のみ、自由入力を保存
      profile/                      生成結果の表示
    services/
      ai/                           text(文章) / image(画像) / vision(解析) を完全に分離したクライアント
      supabase/                     client, storage, repositories(users/velias/generation_history)
  supabase/schema.sql                 最低限のテーブル定義 + RLS
api/rideverse/                        OpenAI呼び出しを行うサーバーレス関数（APIキーを隠す層）
  _lib/config.js                      モデルIDを一箇所に集約（差し替えが容易）
  _lib/veriaDesignReference.js        画像/文章プロンプト共通の世界観・デザイン制約
  analyze-bike.js                     Vision: メーカー/カラー候補
  generate-veria-profile.js           文章生成のみ（画像に依存しない）
  generate-veria-image.js             画像生成のみ（文章に依存しない）
```

`services/ai` と `api/rideverse` の両方で、画像生成と文章生成は互いに依存しない別関数・別APIエンドポイントとして実装しています。将来どちらかのモデルやプロバイダを差し替えても、もう一方に影響しません。

## 実装上の主な判断・提案（未確定事項）

依頼書に明記されていなかった点は、以下のように仮決めして実装しました。実運用前にご確認ください。

1. **ユーザー認証**: MVPではサインアップ画面を作らず、`supabase.auth.signInAnonymously()` による匿名ユーザーをそのまま `users` の owner としています。将来のログイン機能実装時に、匿名ユーザーへの `linkIdentity`等での引き継ぎが必要になります。
2. **画像の永続化**: OpenAI Images APIの結果（base64 or 一時URL）は、名前決定後に初めて Supabase Storage へアップロードして永続URLに差し替えています。生成演出中に表示する画像はOpenAIから返る一時的なものです。
3. **公式ヴェリア（1号機）リファレンス**: 画風指定用に `OPENAI_STYLE_REFERENCE_IMAGE_URL` という環境変数を用意し、共有され次第プロンプトに注記として追加できるようにしています。OpenAIの `images.edit`（画像を渡してスタイルを踏襲）への切り替えも将来検討の余地があります。
4. **AI失敗時の挙動**: 文章・画像どちらかが失敗した場合、生成画面でエラー表示 + 「もう一度試す」で両方を再実行します（部分的な再試行はしていません）。
5. **質問の入力形式**: 依頼書の項目はすべて単一選択（かわいい/かっこいい、性格など）として実装しました。自由記述にすべき項目があれば `QuestionDefinition.type` に `'text'` を追加する形で拡張可能です。
6. **誕生日**: `velias.birthday` は生成（=名前決定）した日のDBサーバー日付をデフォルト値としています。

## 未実装・要検討

- 実機での画像ピッカー権限UIやオフライン時の挙動は最小限のエラーハンドリングのみです。
- `npm install` 済みの環境での実機/シミュレータ動作確認はこの変更には含まれていません（依存追加のみ）。
