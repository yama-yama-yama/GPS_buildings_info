import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from 'react-router-dom'; // React Routerを使うためのもの

function PageB() {
  const navigate = useNavigate();
  const [data, setData] = useState();
  const API_BASE = process.env.REACT_APP_API_URL || "/backend";
  const url = `${API_BASE}/`;
  const [isVisible, setIsVisible] = useState(false);

  const GetData = () => {
		axios.get(url).then((res) => {
			setData(res.data);
      if(!isVisible){
        setIsVisible(true);
      }
      
		});
	};

   const fetchGeoData = async () => {                                                                
      const requestData = {                                                                            
        latitude: 35.658514,                                                                           
        longitude: 139.745474,                                                                         
        facing: [0, 1],           // 方角: 北 (または "北", "N")                                       
        relative_command: "front" // 相対方向: "front", "back", "right", "left"                        
      };                                                                                               
                                                                                                        
      try {                                                                                            
        const response = await fetch(`${API_BASE}/geoapi/`, {
          method: "POST",                                                                              
          headers: {                                                                                   
            "Content-Type": "application/json",                                                        
          },                                                                                           
          body: JSON.stringify(requestData),                                                           
        });                                                                                            
                                                                                                       
        const jsondata = await response.json();                                                            
        console.log("レスポンスデータ:", jsondata); 
        setData(jsondata); 
        if(!isVisible){
          setIsVisible(true); 
        }                                                     
        // data.results に周辺施設情報やGoogle MapsのURLが入っています                                 
      } catch (error) {                                                                                
        console.error("エラーが発生しました:", error);                                                 
      }                                                                                                
    };

    const changePage = () =>{
            navigate('/')
    };

    return (
        <div>
            <h1>Geopyテストページ</h1>
            <button onClick={GetData}>データを取得</button>
            <button onClick={fetchGeoData}>geopyを実行</button>
            <button onClick={changePage}>pageAへ遷移</button>
            <button onClick={() => navigate('/PageC')}>pageCへ遷移</button>
            <button onClick={() => navigate('/PageD')}>pageDへ遷移</button>
            {isVisible && <div>{data.status + "  " + data.message }</div>}
            {isVisible && <div>{data.llm_context}</div>}
        </div>
    );
}

export default PageB;