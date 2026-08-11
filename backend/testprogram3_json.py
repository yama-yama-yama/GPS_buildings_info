import sys
import json
import math
import argparse
import requests
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

class LocationCrawler:
    def __init__(self):
        # ユーザーエージェント
        self.geolocator = Nominatim(user_agent="location_crawler_sample_agent")
        self.session = requests.Session()
            
    def getlocation(self, lat, lon):
        """位置情報から地名・施設名を取得する（逆ジオコーディング）"""
        try:
            location = self.geolocator.reverse((lat, lon), language='ja')
            
            if location:
                # 優先順位: 観光名所 > 建物 > 歴史的建造物 > 近隣施設 > アメニティ
                osm_class = location.raw.get('class', '')
                osm_type = location.raw.get('type', '')
                address_details = location.raw.get('address', {})
                
                priority_keys = ['tourism', 'building', 'historic', 'leisure', 'man_made', 'amenity', 'shop']
                
                if isinstance(osm_class, str) and osm_class:
                    for key in priority_keys:
                        if key in osm_class:
                            return f"{osm_class} => {osm_type} : {location.address.split(',')[0]}"
                
                # 見つからない場合は全体の住所から最初の要素（多くの場合施設名や番地）を取得
                return location.address.split(',')[0]
            return "不明な地点"
        except (GeocoderTimedOut, Exception) as e:
            return f"エラー: {e}"
        
    def direction(self, a, b, latlon):
        """
        指定された方向（比率）に基づいて、緯度・経度を実際の距離（約50m）に換算して返却する。
        """
        if a == 0 and b == 0:
            return latlon

        # 約50mを緯度経度に換算
        METERS_PER_DEGREE_LATITUDE = 111320 # 約111.32km/度
        METERS_PER_DEGREE_LONGITUDE = 111320 * math.cos(math.radians(latlon[0])) # 緯度によって変動

        delta_lat = b * 50 / METERS_PER_DEGREE_LATITUDE
        delta_lon = a * 50 / METERS_PER_DEGREE_LONGITUDE

        new_lat = latlon[0] + delta_lat
        new_lon = latlon[1] + delta_lon

        return (new_lat, new_lon)

    def get_relative_direction_vectors(self, current_direction, relative_command):
        """
        現在向いている方向と相対方向の指示から、探索すべき相対ベクトルを決定する。
        """
        directions_map = {
            (0, 1): 0,    # 北
            (1, 1): 1,    # 北東
            (1, 0): 2,    # 東
            (1, -1): 3,   # 南東
            (0, -1): 4,   # 南
            (-1, -1): 5,  # 南西
            (-1, 0): 6,   # 西
            (-1, 1): 7    # 北西
        }

        reverse_directions_map = {v: k for k, v in directions_map.items()}

        current_idx = directions_map.get(tuple(current_direction))
        if current_idx is None:
            return [] # 不明な方向

        exploration_vectors = []

        if relative_command == "right":
            # 右側3方向 (時計回り)
            for i in range(1, 4):
                idx = (current_idx + i) % 8
                exploration_vectors.append(reverse_directions_map[idx])
        elif relative_command == "left":
            # 左側3方向 (反時計回り)
            for i in range(1, 4):
                idx = (current_idx - i + 8) % 8
                exploration_vectors.append(reverse_directions_map[idx])
        elif relative_command == "front":
            # 前方3方向 (-1, 0, +1)
            for i in [-1, 0, 1]:
                idx = (current_idx + i + 8) % 8
                exploration_vectors.append(reverse_directions_map[idx])
        elif relative_command == "back":
            # 後方3方向 (+3, +4, +5)
            for i in [3, 4, 5]:
                idx = (current_idx + i) % 8
                exploration_vectors.append(reverse_directions_map[idx])

        return exploration_vectors

    def parse_facing(self, facing_input):
        """facing入力を (a, b) タプルに正規化する"""
        if isinstance(facing_input, (list, tuple)) and len(facing_input) == 2:
            return (int(facing_input[0]), int(facing_input[1]))
        elif isinstance(facing_input, str):
            facing_str_map = {
                "北": (0, 1), "N": (0, 1), "north": (0, 1),
                "北東": (1, 1), "NE": (1, 1), "northeast": (1, 1),
                "東": (1, 0), "E": (1, 0), "east": (1, 0),
                "南東": (1, -1), "SE": (1, -1), "southeast": (1, -1),
                "南": (0, -1), "S": (0, -1), "south": (0, -1),
                "南西": (-1, -1), "SW": (-1, -1), "southwest": (-1, -1),
                "西": (-1, 0), "W": (-1, 0), "west": (-1, 0),
                "北西": (-1, 1), "NW": (-1, 1), "northwest": (-1, 1)
            }
            if facing_input in facing_str_map:
                return facing_str_map[facing_input]
            try:
                parts = [int(p.strip()) for p in facing_input.strip("()[]").split(",")]
                if len(parts) == 2:
                    return (parts[0], parts[1])
            except Exception:
                pass
        return (0, 1) # デフォルト: 北

    def process(self, input_data):
        """
        JSON形式の入力辞書を受け取り、結果の辞書データ（JSON変換可能）を返す
        """
        lat = float(input_data.get("latitude", input_data.get("lat", 35.658514)))
        lon = float(input_data.get("longitude", input_data.get("lon", 139.745474)))
        facing_raw = input_data.get("facing", input_data.get("direction", [0, 1]))
        rel_cmd = input_data.get("relative_command", input_data.get("relative_dir", "front"))

        facing = self.parse_facing(facing_raw)
        current_latlon = (lat, lon)

        exploration_vectors = self.get_relative_direction_vectors(facing, rel_cmd)
        if not exploration_vectors:
            return {
                "status": "error",
                "message": f"探索方向を特定できませんでした。facing: {facing}, relative_command: {rel_cmd}"
            }

        vector_names = {
            (0, 1): "北 ↑",
            (1, 1): "北東 ↗",
            (1, 0): "東 →",
            (1, -1): "南東 ↘",
            (0, -1): "南 ↓",
            (-1, -1): "南西 ↙",
            (-1, 0): "西 ←",
            (-1, 1): "北西 ↖"
        }

        cmd_ja_map = {"front": "前", "back": "後", "right": "右", "left": "左"}
        rel_cmd_ja = cmd_ja_map.get(rel_cmd, rel_cmd)
        facing_str = vector_names.get(facing, f"({facing[0]}, {facing[1]})")

        results = []
        llm_context_parts = []

        for vec_a, vec_b in exploration_vectors:
            vec_name = vector_names.get((vec_a, vec_b), f"ベクトル({vec_a}, {vec_b})")
            target_latlon = self.direction(vec_a, vec_b, current_latlon)
            location_data = self.getlocation(target_latlon[0], target_latlon[1])

            maps_url = f"https://www.google.com/maps/search/?api=1&query={target_latlon[0]:.6f},{target_latlon[1]:.6f}"

            results.append({
                "vector": [vec_a, vec_b],
                "vector_name": vec_name,
                "latitude": target_latlon[0],
                "longitude": target_latlon[1],
                "google_maps_url": maps_url,
                "location": location_data
            })

            llm_context_parts.append(f"[{vec_name}方向 (約50m先)] {location_data}")

        output_text = f"現在の位置: 緯度 {current_latlon[0]:.6f}, 経度 {current_latlon[1]:.6f}\n"
        output_text += f"向いている方角: {facing_str}\n"
        output_text += f"注目する相対方向: {rel_cmd_ja}側\n"
        output_text += "----------------------------------------\n"
        output_text += "\n".join(llm_context_parts)

        return {
            "status": "success",
            "input": {
                "latitude": lat,
                "longitude": lon,
                "facing": list(facing),
                "facing_name": facing_str,
                "relative_command": rel_cmd
            },
            "results": results,
            "llm_context": output_text
        }

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

    parser = argparse.ArgumentParser(description="周辺探索 & 逆ジオコーディング CLIツール (JSON対応)")
    parser.add_argument("-i", "--input", help="入力JSONファイルのパス（未指定の場合は標準入力またはデフォルト値）")
    parser.add_argument("-o", "--output", help="出力JSONファイルのパス（未指定の場合は標準出力）")
    parser.add_argument("--json", help="入力JSON文字列")
    args = parser.parse_args()

    input_data = None

    if args.json:
        try:
            input_data = json.loads(args.json)
        except json.JSONDecodeError as e:
            print(json.dumps({"status": "error", "message": f"JSON解析エラー: {e}"}, ensure_ascii=False, indent=2), file=sys.stderr)
            sys.exit(1)
    elif args.input:
        try:
            with open(args.input, 'r', encoding='utf-8') as f:
                input_data = json.load(f)
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"入力ファイル読み込みエラー: {e}"}, ensure_ascii=False, indent=2), file=sys.stderr)
            sys.exit(1)
    elif not sys.stdin.isatty():
        try:
            raw_input = sys.stdin.read().strip()
            if raw_input:
                input_data = json.loads(raw_input)
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"標準入力のJSON解析エラー: {e}"}, ensure_ascii=False, indent=2), file=sys.stderr)
            sys.exit(1)

    # デモデータ
    if input_data is None:
        input_data = {
            "latitude": 35.658514,
            "longitude": 139.745474,
            "facing": [0, 1],
            "relative_command": "front"
        }

    crawler = LocationCrawler()
    output_data = crawler.process(input_data)

    json_str = json.dumps(output_data, ensure_ascii=False, indent=2)

    if args.output:
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(json_str)
            print(f"結果を {args.output} に保存しました。", file=sys.stderr)
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"出力ファイル書き込みエラー: {e}"}, ensure_ascii=False, indent=2), file=sys.stderr)
            sys.exit(1)
    else:
        print(json_str)

if __name__ == "__main__":
    main()
