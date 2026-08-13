import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// 方位角（0〜360度）から8方位の名称を取得
const getDirectionName = (heading) => {
  if (heading === null || heading === undefined) return { name: "計測中...", code: "---" };

  const directions8 = [
    { name: "北", code: "N" },
    { name: "北東", code: "NE" },
    { name: "東", code: "E" },
    { name: "南東", code: "SE" },
    { name: "南", code: "S" },
    { name: "南西", code: "SW" },
    { name: "西", code: "W" },
    { name: "北西", code: "NW" },
  ];

  // 360度を8等分 (45度区切り、オフセット22.5度)
  const index = Math.floor(((heading + 22.5) % 360) / 45);
  return directions8[index] || directions8[0];
};

function PageC() {
  const navigate = useNavigate();

  const [heading, setHeading] = useState(null);                      // コンパス方位角 (0-360)
  const [permissionState, setPermissionState] = useState("unknown"); // "unknown" | "granted" | "denied" | "unsupported"
  const [isIOS, setIsIOS] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleOrientation = React.useCallback((event) => {
    let compassHeading = null;

    // iOS WebKitCompassHeading (iOS Chrome / Safari)
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
      compassHeading = event.webkitCompassHeading;
    } 
    // Android / 標準 DeviceOrientation API
    else if (event.alpha !== undefined && event.alpha !== null) {
      // alpha: 0~360度 (反時計回り または absolute)
      compassHeading = (360 - event.alpha) % 360;
    }

    if (compassHeading !== null) {
      setHeading(Math.round(compassHeading));
    }
  }, []);

  const startCompass = React.useCallback(() => {
    window.addEventListener("deviceorientation", handleOrientation, true);
    setPermissionState("granted");
  }, [handleOrientation]);

  const stopCompass = React.useCallback(() => {
    window.removeEventListener("deviceorientation", handleOrientation, true);
  }, [handleOrientation]);

  useEffect(() => {
    // iOS判定
    const isIOSDevice =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !window.MSStream;
    setIsIOS(isIOSDevice);

    // DeviceOrientationEvent のサポート確認
    if (!window.DeviceOrientationEvent) {
      setPermissionState("unsupported");
      setErrorMessage("お使いのブラウザ・端末は地磁気センサー(DeviceOrientation)に対応していません。");
    } else if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      // iOS 13+ の場合はボタンタップでパーミッション要求が必要
      setPermissionState("unknown");
    } else {
      // Android / iOS12 以前等のパーミッション要求不要環境
      startCompass();
    }

    return () => {
      stopCompass();
    };
  }, [startCompass, stopCompass]);

  // iOS 13+ 用 パーミッションリクエストボタンハンドラー
  const requestPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === "granted") {
          startCompass();
        } else {
          setPermissionState("denied");
          setErrorMessage("センサーアクセスの許可が拒否されました。設定から許可してください。");
        }
      } catch (error) {
        console.error(error);
        setErrorMessage(`許可要求エラー: ${error.message}`);
      }
    } else {
      startCompass();
    }
  };

  const dir = getDirectionName(heading);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
      <h1>地磁気センサー (コンパス)</h1>

      {/* iOS 許可要求ボタン */}
      {isIOS === false && <div>this is not ios</div>}
      {permissionState === "unknown" && (
        <div style={{ margin: "20px 0", padding: "15px", background: "#eef6ff", borderRadius: "10px", border: "1px solid #b6d4fe" }}>
          <p style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
            iOS (iPhone/iPad) の場合、地磁気・傾きセンサーの使用許可が必要です。
          </p>
          <button
            onClick={requestPermission}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              fontWeight: "bold",
              color: "#fff",
              background: "#0d6efd",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            センサーアクセスを許可する
          </button>
        </div>
      )}

      {permissionState === "denied" && (
        <div style={{ color: "red", margin: "15px 0" }}>
          {errorMessage || "センサーのアクセス許可が拒否されました。"}
        </div>
      )}

      {permissionState === "unsupported" && (
        <div style={{ color: "orange", margin: "15px 0" }}>
          {errorMessage || "地磁気センサーがサポートされていません。"}
        </div>
      )}

      {/* 方角表示エリア */}
      <div style={{ margin: "30px 0" }}>
        <div
          style={{
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            border: "6px solid #333",
            margin: "0 auto 20px auto",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fafafa",
            boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
          }}
        >
          {/* コンパス針 */}
          <div
            style={{
              position: "absolute",
              width: "8px",
              height: "160px",
              transform: `rotate(${heading ?? 0}deg)`,
              transition: "transform 0.1s ease-out",
            }}
          >
            {/* 北の赤針 */}
            <div style={{ height: "50%", background: "#e63946", borderRadius: "4px 4px 0 0" }} />
            {/* 南の青針 */}
            <div style={{ height: "50%", background: "#457b9d", borderRadius: "0 0 4px 4px" }} />
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 2,
              background: "rgba(255,255,255,0.9)",
              padding: "10px 15px",
              borderRadius: "20px",
              fontWeight: "bold",
            }}
          >
            {heading !== null ? `${heading}°` : "---"}
          </div>
        </div>

        <h2 style={{ fontSize: "28px", margin: "10px 0", color: "#1d3557" }}>
          向いている方角: {dir.name} ({dir.code})
        </h2>
        <p style={{ color: "#6c757d", fontSize: "14px" }}>
          角度: {heading !== null ? `${heading}度` : "取得中..."}
        </p>
      </div>

      <div style={{ marginTop: "30px" }}>
        <button
          onClick={() => navigate("/")}
          style={{ padding: "8px 16px", margin: "5px" }}
        >
          PageAへ
        </button>
        <button
          onClick={() => navigate("/PageB")}
          style={{ padding: "8px 16px", margin: "5px" }}
        >
          PageBへ
        </button>
        <button onClick={() => navigate('/PageD')}>pageDへ遷移</button>
      </div>
    </div>
  );
}

export default PageC;
