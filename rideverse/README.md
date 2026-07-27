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
  design/official-velia-001-reference.png  公式ヴェリア1号機「リヴェラ」デザインシート（実データ）
api/rideverse/                        OpenAI呼び出しを行うサーバーレス関数（APIキーを隠す層）
  _lib/config.js                      モデルIDを一箇所に集約（差し替えが容易）
  _lib/veriaDesignReference.js        世界観・Bike Type→Theme方向性・重み・生成順・Style DNAを集約
  _lib/answerThemeMap.js              質問回答(option id) → Theme Keywords への変換テーブル
  _lib/colorMoodMap.js                自転車のメイン/差し色 → Theme Keywords への変換
  _lib/randomFlavor.js                10%以内のランダムな個性ヒントを1つ選ぶ
  analyze-bike.js                     STEP1 Vision: bikeType/manufacturer/model/color/wheel/frame（推測禁止・unknown可）
  generate-veria-profile.js           STEP2 文章生成のみ（画像に依存しない）
  generate-veria-image.js             STEP3 画像生成のみ（STEP2の theme/species/personality を入力に取る）
```

`services/ai` と `api/rideverse` の両方で、画像生成と文章生成は別モデル設定・別APIエンドポイントとして実装しています。将来どちらかのモデルやプロバイダを差し替えても、もう一方に影響しません。

## Velia Generation Reference v1.1 対応（生成品質向上の修正）

「AI生成品質向上」の依頼を受け、生成ロジックを以下のとおり修正しました。

**① Themeを最上位にする** — 生成順序を `BikeType -> Theme -> Species -> Personality -> Appearance` に変更（`_lib/veriaDesignReference.js` の `GENERATION_ORDER_NOTE`）。Bike Typeごとの方向性テーブルも「Species候補」ではなく「Themeキーワード + Species候補」の形（`BIKE_TYPE_DIRECTIONS`）に更新し、Themeを世界観の中心に置いています。

**② Style DNAを追加** — `STYLE_DNA`（2.5頭身・Large head・Round silhouette・Pastel color palette 等、依頼書のリストそのまま）と `SD_PROPORTION_MANDATE`（「現在よりさらに頭を大きく、体を小さく。公式ヴェリア1号機の頭身・可愛さを基準に」）を新設し、STEP3の画像プロンプトへ毎回必ず含めています。

**③ 質問回答→AI影響テーブル** — `_lib/answerThemeMap.js` を新設。質問の生の回答（例:「ヒルクライム」）はAIに渡さず、`Challenge / Persistence / Growth` のようなThemeキーワードへ変換してから渡します。自転車のカラーも同様に `_lib/colorMoodMap.js` で変換します（Bike Design分の20%の影響を担当）。

**④ Personalityはキーワード生成にする** — STEP2の出力を `personality.emotionKeywords`（例: Brave, Cheerful, Calm）→ `personality.description` の順で生成するようプロンプトを変更しました。

**⑤ Appearanceは最後に決定** — プロンプトの生成順序ノートで「Appearanceを先に決めないこと」を明記し、Species・Personality・Theme・メインカラー・差し色が揃った最後にAppearanceを生成させています。

**⑥ 将来拡張しやすい構造** — AI出力・DB・クライアント型を `{ theme, species, personality, appearance, voice, imagePrompt, metadata }` の構造に変更しました（`src/types/veria.ts`）。`theme`/`personality`/`appearance`/`voice`/`metadata` はDB上もjsonbカラムにしており、将来イベントや季節情報を`theme`に足すといった拡張がマイグレーション不要で行えます。名前候補(`nameCandidates`)は実務上の置き場所として `metadata` に格納しています（依頼書の7キー構成には含まれていなかったため、この配置は今回の判断です）。

**⑦ MVP非実装（TODOのみ）** — 感情システム・進化・モーション変化・表情追加・会話学習・季節イベント・部屋・家具は、`src/types/veria.ts` の末尾にTODOコメントとしてのみ記載し、コードは実装していません。

### 「なぜこの姿になったか」画面への準備

次フェーズで検討されている生成理由の説明画面に向けて、STEP2の出力に `metadata.generationReason`（例: 「あなたは朝のライドと海辺の景色が好きなので、風をテーマにしたウルフのヴェリアが誕生しました。」）を追加しました。今回はプロフィール画面に一行だけ軽くプレビュー表示していますが、依頼のとおり専用の演出画面自体は次フェーズの実装として残しています。

### 画像生成とテキスト生成の関係（重要な設計判断）

STEP3は入力に `Theme / Species / Personality`（＝STEP2の出力）を含めています。そのため `useVeriaGeneration` は並列実行ではなく、**STEP2完了後にSTEP2の結果をSTEP3へ渡す逐次実行**です。とはいえモデル・プロンプト・APIエンドポイントは引き続き別ファイル・別関数であり、Vision→Personality→Imageの3段階構成、および「画像生成と文章生成の完全分離」はモデル差し替えの自由度という意味で維持されています。

### 公式リファレンス画像について

`rideverse/design/official-velia-001-reference.png` として実データをリポジトリに保存しています。ただしこのシートは複数ポーズ・表情・設定表を含む1枚の複合画像（インフォグラフィック）のため、OpenAI Images生成APIにそのまま画像入力として渡す（`images.edit`）と、キャラクター以外の要素（表・日本語ラベル）を誤って再現するリスクが高いと判断し、**現時点ではテキストによるスタイル記述**（`OFFICIAL_REFERENCE_STYLE_NOTE` / `SD_PROPORTION_MANDATE`）としてプロンプトに反映しています。正面立ち絵のみを切り出した参照画像を別途用意できれば、`images.edit` による直接的なスタイル継承への切り替えが可能です。

## 実装上の主な判断・提案（未確定事項）

依頼書に明記されていなかった点は、以下のように仮決めして実装しました。実運用前にご確認ください。

1. **ユーザー認証**: MVPではサインアップ画面を作らず、`supabase.auth.signInAnonymously()` による匿名ユーザーをそのまま `users` の owner としています。将来のログイン機能実装時に、匿名ユーザーへの `linkIdentity`等での引き継ぎが必要になります。
2. **画像の永続化**: OpenAI Images APIの結果（base64 or 一時URL）は、名前決定後に初めて Supabase Storage へアップロードして永続URLに差し替えています。生成演出中に表示する画像はOpenAIから返る一時的なものです。
3. **AI失敗時の挙動**: 文章・画像どちらかが失敗した場合、生成画面でエラー表示 + 「もう一度試す」でSTEP2から再実行します（部分的な再試行はしていません）。
4. **誕生日**: `velias.birthday` は生成（=名前決定）した日のDBサーバー日付をデフォルト値としています。
5. **成長要素**: 依頼書どおりMVPでは実装していません（表情差分・会話・モーションは将来のロードマップとしてコードに含めていません）。

## 未実装・要検討

- 実機での画像ピッカー権限UIやオフライン時の挙動は最小限のエラーハンドリングのみです。
- `npm install` 済みの環境での実機/シミュレータ動作確認はこの変更には含まれていません（依存追加のみ）。
- `images.edit` を使った公式リファレンス画像の直接継承は未実装（上記「公式リファレンス画像について」参照）。
