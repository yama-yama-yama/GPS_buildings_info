from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Union, List
import uvicorn
from testprogram3_json import LocationCrawler

app = FastAPI(
    title="Location Crawler API",
    description="ReactフロントエンドからJSONリクエストを受け取り、周辺情報の逆ジオコーディング結果をJSONで応答するAPI",
    version="1.0.0"
)

# React等のフロントエンドからのアクセスを許可するためのCORS設定
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発環境用に全オリジンを許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# サーバー起動時にLocationCrawlerのインスタンスを作成
crawler = LocationCrawler()

class GeoRequest(BaseModel):
    latitude: float = Field(..., description="緯度 (例: 35.658514)")
    longitude: float = Field(..., description="経度 (例: 139.745474)")
    facing: Union[List[int], str] = Field(default=[0, 1], description="現在向いている方角 (例: [0, 1] または '北')")
    relative_command: str = Field(default="front", description="相対方向指示 ('front', 'back', 'right', 'left')")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "latitude": 35.658514,
                    "longitude": 139.745474,
                    "facing": [0, 1],
                    "relative_command": "front"
                }
            ]
        }
    }

@app.get("/")
def root():
    return {
        "status": "online",
        "message": "Location Crawler API is running.",
        "endpoint": "/geoapi/"
    }

@app.post("/geoapi/")
def geoapi(req: GeoRequest):
    """
    Reactフロントエンドから受け取ったJSONデータ(GeoRequest)を元に
    LocationCrawlerを実行し、処理結果のJSONを返すエンドポイント
    """
    try:
        input_data = req.model_dump()
        result = crawler.process(input_data)
        
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message"))
            
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


