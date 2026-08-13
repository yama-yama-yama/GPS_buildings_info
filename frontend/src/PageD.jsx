import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_URL || "/backend";

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
 * (PageAの差分判定と同じ)
 */
const estimateDirection = (x_n, y_n, x_b, y_b, threshold = 0.000001) => {
  if (x_b === null || y_b === null || x_b === undefined || y_b === undefined) {
    return { dx: 0, dy: 0, name: "静止", isMoved: false, diffX: 0, diffY: 0 };
  }
  const diffX = x_n - x_b;
  const diffY = y_n - y_b;
  const dx = Math.abs(diffX) < threshold ? 0 : Math.sign(diffX);
  const dy = Math.abs(diffY) < threshold ? 0 : Math.sign(diffY);
  const key = `${dx},${dy}`;
  const name = DIRECTION_MAP[key] || "不明";
  const isMoved = !(dx === 0 && dy === 0);
  return { dx, dy, name, diffX, diffY, isMoved };
};

/**
 * 方位角(0-360度、時計回り・北起点)を8方位ベクトル [a, b] に変換する
 * (0,1)=北 (1,0)=東 (0,-1)=南 (-1,0)=西 など
 */
const headingToVector = (heading) => {
  const directions8 = [
    [0, 1], [1, 1], [1, 0], [1, -1],
    [0, -1], [-1, -1], [-1, 0], [-1, 1],
  ];
  const index = Math.floor(((heading + 22.5) % 360) / 45);
  return directions8[index] || directions8[0];
};

function PageD() {
  const navigate = useNavigate();

  // 方角の取得モード: "diff"=差分(GPS) / "mag"=地磁気センサー
  const [mode, setMode] = useState("diff");

  // GPS
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const beforeCoordRef = useRef(null); // 差分用の直前座標 {x: 経度, y: 緯度}

  // 地磁気センサー
  const [heading, setHeading] = useState(null);
  const [permissionState, setPermissionState] = useState("unknown");
  const [listening, setListening] = useState(false);

  // 現在の向き (facing)
  const [facing, setFacing] = useState(null);

  // geoapi結果
  const [relativeCommand, setRelativeCommand] = useState("front");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

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

  // GPSで現在位置を取得
  const getGps = async () => {
    setStatus("位置情報を取得中...");
    try {
      const pos = await getPositionPromise();
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;
      const acc = pos.coords.accuracy;
      setLat(latitude);
      setLon(longitude);
      setAccuracy(acc);
      setStatus(`GPS: 緯度 ${latitude.toFixed(6)}, 経度 ${longitude.toFixed(6)}, 精度 ${acc}m`);
    } catch (error) {
      setStatus(`GPS取得失敗: ${error.message}`);
    }
  };

  // 差分(GPS)で方角を計算
  const computeDiffDirection = (cLat, cLon) => {
    const prev = beforeCoordRef.current;
    const result = estimateDirection(cLon, cLat, prev ? prev.x : null, prev ? prev.y : null);
    if (result.isMoved) {
      beforeCoordRef.current = { x: cLon, y: cLat };
    } else if (prev === null) {
      beforeCoordRef.current = { x: cLon, y: cLat };
    }
    setFacing({ dx: result.dx, dy: result.dy, name: result.name });
    return result;
  };

  // 地磁気センサーのイベント処理 (iOS: webkitCompassHeading, Android: alpha)
  const handleOrientation = useCallback((event) => {
    let compassHeading = null;
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
      compassHeading = event.webkitCompassHeading;
    } else if (event.alpha !== undefined && event.alpha !== null) {
      compassHeading = (360 - event.alpha) % 360;
    }
    if (compassHeading !== null) {
      setHeading(Math.round(compassHeading));
    }
  }, []);

  // iOS判定と対応確認
  useEffect(() => {
    if (!window.DeviceOrientationEvent) {
      setPermissionState("unsupported");
    }
  }, []);

  // 地磁気センサーのリスナーを開始/停止
  useEffect(() => {
    if (listening) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }
    return () => window.removeEventListener("deviceorientation", handleOrientation, true);
  }, [listening, handleOrientation]);

  // 地磁気モード時、headingをfacing(8方位ベクトル)へ変換
  useEffect(() => {
    if (mode === "mag" && heading !== null) {
      const [a, b] = headingToVector(heading);
      setFacing({ dx: a, dy: b, name: DIRECTION_MAP[`${a},${b}`] || "不明" });
    }
  }, [mode, heading]);

  // iOS 13+ 用 地磁気センサーのパーミッション要求 (ユーザー操作内で呼ぶこと)
  const changeMode = async (newMode) => {
    setMode(newMode);
    setResult(null);
    if (newMode === "mag") {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        try {
          const response = await DeviceOrientationEvent.requestPermission();
          if (response === "granted") {
            setListening(true);
            setPermissionState("granted");
            setStatus("地磁気センサー許可OK");
          } else {
            setListening(false);
            setPermissionState("denied");
            setStatus("地磁気センサーの許可が拒否されました");
          }
        } catch (error) {
          console.error(error);
          setStatus(`許可エラー: ${error.message}`);
        }
      } else {
        setListening(true);
        setPermissionState("granted");
        setStatus("地磁気センサー開始");
      }
    } else {
      setListening(false);
      setStatus("差分(GPS)モードに切り替え");
    }
  };

  // 現在の向きを取得 (モードにより挙動が変わる)
  const getDirection = async () => {
    if (mode === "diff") {
      setStatus("位置を取得して差分計算中...");
      try {
        const pos = await getPositionPromise();
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude);
        setLon(longitude);
        const dir = computeDiffDirection(latitude, longitude);
        setStatus(`差分: ${dir.name} (Δx=${dir.dx}, Δy=${dir.dy})`);
      } catch (error) {
        setStatus(`差分計算失敗: ${error.message}`);
      }
    } else {
      // mag
      if (!listening) {
        await changeMode("mag");
      }
      if (heading !== null) {
        const [a, b] = headingToVector(heading);
        const name = DIRECTION_MAP[`${a},${b}`] || "不明";
        setFacing({ dx: a, dy: b, name });
        setStatus(`地磁気: ${heading}° → ${name} [${a},${b}]`);
      } else {
        setStatus("地磁気センサーから値が取得できていません。端末を動かしてください。");
      }
    }
  };

  // geoapi実行 (現在の座標 + 方角を送る)
  const runGeoapi = async () => {
    if (lat === null || lon === null) {
      setStatus("先に位置情報を取得してください");
      return;
    }
    if (!facing) {
      setStatus("先に向き(方角)を取得してください");
      return;
    }
    setBusy(true);
    setStatus(`geoapi呼び出し中... facing=[${facing.dx}, ${facing.dy}], ${relativeCommand}`);
    try {
      const response = await fetch(`${API_BASE}/geoapi/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lon,
          facing: [facing.dx, facing.dy],
          relative_command: relativeCommand,
        }),
      });
      const json = await response.json();
      setResult(json);
      setStatus(`geoapi応答: ${json.status || response.status}`);
    } catch (error) {
      setStatus(`geoapiエラー: ${error.message}`);
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const segStyle = (active) => ({
    padding: "6px 14px",
    border: "none",
    cursor: "pointer",
    background: active ? "#0d6efd" : "#e9ecef",
    color: active ? "#fff" : "#333",
    fontSize: "14px",
  });

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "20px" }}>PageD: GPS + 方角 → geoapi</h1>
      <button onClick={() => navigate('/PageA')}>pageAへ遷移</button>
      <button onClick={() => navigate('/PageB')}>pageBへ遷移</button>
      <button onClick={() => navigate('/PageC')}>pageCへ遷移</button>

      {/* トグルスイッチ */}
      <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "14px" }}>方角の取得方法:</span>
        <div style={{ display: "inline-flex", border: "1px solid #ccc", borderRadius: "20px", overflow: "hidden" }}>
          <button onClick={() => changeMode("diff")} style={segStyle(mode === "diff")}>差分(GPS)</button>
          <button onClick={() => changeMode("mag")} style={segStyle(mode === "mag")}>地磁気</button>
        </div>
      </div>

      {mode === "mag" && permissionState === "denied" && (
        <div style={{ color: "red", fontSize: "13px", marginBottom: "8px" }}>
          地磁気センサーの許可が拒否されています。設定アプリから許可してください。
        </div>
      )}
      {mode === "mag" && permissionState === "unsupported" && (
        <div style={{ color: "orange", fontSize: "13px", marginBottom: "8px" }}>
          この端末はDeviceOrientationに対応していません。
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "12px 0" }}>
        <button onClick={getGps}>GPS位置取得</button>
        <button onClick={getDirection}>方角取得</button>
        <button onClick={runGeoapi} disabled={busy}>{busy ? "処理中..." : "geoapi実行"}</button>
      </div>

      <div style={{ fontSize: "13px", color: "#444", margin: "8px 0" }}>
        {status}
      </div>

      {/* 現在値の表示 */}
      <div style={{ fontSize: "14px", background: "#f8f9fa", padding: "10px", borderRadius: "8px", margin: "8px 0" }}>
        <div>緯度: {lat !== null ? lat.toFixed(6) : "未取得"} / 経度: {lon !== null ? lon.toFixed(6) : "未取得"}{accuracy !== null ? ` (精度 ${accuracy}m)` : ""}</div>
        <div>方角({mode === "diff" ? "差分" : "地磁気"}): {facing ? `${facing.name} [${facing.dx}, ${facing.dy}]` : "未取得"}</div>
        {mode === "mag" && <div>heading: {heading !== null ? `${heading}°` : "---"}</div>}
      </div>

      {/* relative_command選択 */}
      <div style={{ margin: "8px 0", fontSize: "14px" }}>
        <label>
          relative_command:
          <select value={relativeCommand} onChange={(e) => setRelativeCommand(e.target.value)} style={{ marginLeft: "8px" }}>
            <option value="front">front</option>
            <option value="back">back</option>
            <option value="right">right</option>
            <option value="left">left</option>
          </select>
        </label>
      </div>

      {/* geoapi結果表示 */}
      {result && (
        <div style={{ marginTop: "12px", fontSize: "14px" }}>
          <h3 style={{ fontSize: "16px", margin: "8px 0" }}>geoapi結果</h3>
          <div>status: {result.status}</div>
          {result.llm_context && (
            <pre style={{ whiteSpace: "pre-wrap", background: "#f0f0f0", padding: "10px", borderRadius: "8px" }}>
              {result.llm_context}
            </pre>
          )}
          {result.message && <div style={{ color: "#b02a37" }}>{result.message}</div>}
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: "#555" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <button onClick={() => navigate("/")} style={{ padding: "8px 16px" }}>PageAへ</button>
        <button onClick={() => navigate("/PageB")} style={{ padding: "8px 16px", marginLeft: "8px" }}>PageBへ</button>
        <button onClick={() => navigate("/PageC")} style={{ padding: "8px 16px", marginLeft: "8px" }}>PageCへ</button>
      </div>
    </div>
  );
}

export default PageD;