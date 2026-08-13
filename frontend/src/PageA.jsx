import { useNavigate } from 'react-router-dom'; // React Routerを使うためのもの
import React, { useState } from "react";

// 向きの8パターン（座標表現）定義
const DIRECTION_MAP = {
  "-1,1": "北西",
  "0,1": "北",
  "1,1": "北東",
  "-1,0": "西",
  "0,0": "静止",
  "1,0": "東",
  "-1,-1": "南西",
  "0,-1": "南",
  "1,-1": "南東",
};

/**
 * 座標の変化から現在の向いている方向を推定するアルゴリズム
 * @param {number} x_n - 現在の東経 (longitude)
 * @param {number} y_n - 現在の北緯 (latitude)
 * @param {number} x_b - 直前の東経
 * @param {number} y_b - 直前の北緯
 * @param {number} threshold - 微小変化の判定閾値
 */
export const estimateDirection = (x_n, y_n, x_b, y_b, threshold = 0.000001) => {
  if (x_b === null || y_b === null || x_b === undefined || y_b === undefined) {
    return { dx: 0, dy: 0, name: "静止", isMoved: false, diffX: 0, diffY: 0 };
  }

  const diffX = x_n - x_b; // 東経の変化
  const diffY = y_n - y_b; // 北緯の変化

  // 閾値未満の変化は 0 と判定
  const dx = Math.abs(diffX) < threshold ? 0 : Math.sign(diffX);
  const dy = Math.abs(diffY) < threshold ? 0 : Math.sign(diffY);

  const key = `${dx},${dy}`;
  const name = DIRECTION_MAP[key] || "不明";
  const isMoved = !(dx === 0 && dy === 0);

  return { dx, dy, name, diffX, diffY, isMoved };
};

function PageA() {
  const navigate = useNavigate();

  // 座標状態 (x: 経度 lon, y: 緯度 lat)
  const [beforeCoord, setBeforeCoord] = useState(null); // before_coord (x_b, y_b)
  const [nowCoord, setNowCoord] = useState(null);       // now_coord (x_n, y_n)
  
  // 推定結果
  const [directionResult, setDirectionResult] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  // 手動テスト・シミュレーション用の入力値
  const [manualX, setManualX] = useState("139.745474");
  const [manualY, setManualY] = useState("35.658514");

  const changePage = () => {
    navigate('/PageB');
  };

  // Geolocation APIのPromise化
  const getPositionPromise = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("位置情報サービスがサポートされていません"));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }
    });
  };

  // GPS起動ボタン
  const Getgps = async () => {
    setGpsStatus("位置情報を取得中...");
    try {
      const pos = await getPositionPromise();
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;

      const current = { x: lon, y: lat };
      setNowCoord(current);
      setGpsStatus(`緯度:${lat} 経度:${lon} 精度:${accuracy}m`);
    } catch (error) {
      setGpsStatus(`取得失敗: ${error.message}`);
    }
  };

  // 差分計算コア関数
  const calculateDiff = (nextX, nextY) => {
    const x_n = parseFloat(nextX);
    const y_n = parseFloat(nextY);

    if (isNaN(x_n) || isNaN(y_n)) {
      alert("有効な数値座標を入力してください");
      return;
    }

    const current = { x: x_n, y: y_n };
    setNowCoord(current);

    if (beforeCoord === null) {
      // 初回は比較対象がないため直前座標として保持
      setBeforeCoord(current);
      setDirectionResult({
        dx: 0,
        dy: 0,
        name: "静止 (初期座標設定)",
        isMoved: false,
        diffX: 0,
        diffY: 0,
      });
      setIsVisible(true);
      return;
    }

    // アルゴリズムで向きを推定
    const result = estimateDirection(current.x, current.y, beforeCoord.x, beforeCoord.y);
    setDirectionResult(result);
    setIsVisible(true);

    // ※変化がない場合は before_coord を更新しない
    if (result.isMoved) {
      setBeforeCoord(current);
    }
  };

  // 「差分」ボタン (GPSを使用)
  const GetDirection = async () => {
    setGpsStatus("位置情報を取得中...");
    try {
      const pos = await getPositionPromise();
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setGpsStatus(`最新データ取得完了 - 緯度:${lat}, 経度:${lon}`);
      calculateDiff(lon, lat);
    } catch (error) {
      setGpsStatus(`取得失敗: ${error.message}`);
    }
  };

  // 手動シミュレーション差分計算
  const handleManualDiff = () => {
    calculateDiff(manualX, manualY);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>GPSと方向推定（差分判定）</h1>
      <div style={{ marginBottom: "15px", color: "#444" }}>{gpsStatus}</div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={Getgps}>GPS起動</button>
        <button onClick={GetDirection}>差分</button>
        <button onClick={changePage}>pageBへ遷移</button>
        <button onClick={() => navigate('/PageC')}>pageCへ遷移</button>
        <button onClick={() => navigate('/PageD')}>pageDへ遷移</button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h3>手動座標テスト (動作確認用)</h3>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "15px", flexWrap: "wrap" }}>
        <label>
          経度 x_n:
          <input
            type="number"
            step="0.0001"
            value={manualX}
            onChange={(e) => setManualX(e.target.value)}
            style={{ marginLeft: "5px", padding: "5px" }}
          />
        </label>
        <label>
          緯度 y_n:
          <input
            type="number"
            step="0.0001"
            value={manualY}
            onChange={(e) => setManualY(e.target.value)}
            style={{ marginLeft: "5px", padding: "5px" }}
          />
        </label>
        <button onClick={handleManualDiff}>手動座標で差分計算</button>
      </div>

      {isVisible && directionResult && (
        <div style={{ marginTop: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "8px", background: "#f8f9fa" }}>
          <h2>推定結果</h2>
          <p style={{ fontSize: "18px", fontWeight: "bold", color: "#0056b3" }}>
            向いている方向: {directionResult.name} (符号: Δx={directionResult.dx}, Δy={directionResult.dy})
          </p>
          <p><strong>現在座標 now_coord (x_n, y_n):</strong> {nowCoord ? `(${nowCoord.x}, ${nowCoord.y})` : "未設定"}</p>
          <p><strong>直前座標 before_coord (x_b, y_b):</strong> {beforeCoord ? `(${beforeCoord.x}, ${beforeCoord.y})` : "未設定"}</p>
          <p><strong>変化量 (Δx, Δy):</strong> Δx = {directionResult.diffX}, Δy = {directionResult.diffY}</p>
          <p style={{ fontSize: "13px", color: "#6c757d" }}>
            ※変化がない場合 (符号 0,0)、直前座標 before_coord は更新されません。
          </p>
        </div>
      )}
    </div>
  );
}

export default PageA;