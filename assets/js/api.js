let apiKey = 'a0eace9ccff525be4601e59c9d29c184';
let apiBase = 'https://api.openweathermap.org/';

let directGeoRoute = 'geo/1.0/direct';
let currentWeatherRoute = 'data/2.5/weather';
let forecastRoute = 'data/2.5/forecast';

let convertKToF = (kelvin) => Math.round((1.8 * (kelvin - 273)) + 32);
let convertMStoMPH = (ms) => Math.round(ms * 2.236936);
let formatURL = (route) => apiBase + route;
let appendAppID = (requestUrl) => requestUrl + `&appid=${apiKey}`;
let convertPromiseToJSON = (response) => response.json();
let verifyGood = (json) => {
    // if the json is a good request or it's a JSON array
    if((json.cod >= 200 && json.cod < 400) || Array.isArray(json)) {
        return json;
    }

    throw {reason: 'error with request', payload: json};
};

function directGeocode(geoInfo) {
    let requestUrl = formatURL(directGeoRoute);

    requestUrl += `?q=${geoInfo.name}`;
    if(geoInfo.state) {
        requestUrl += `,${geoInfo.state}`;
    }
    if(geoInfo.country) {
        requestUrl += `,${geoInfo.country}`;
    }

    requestUrl += '&limit=1';
    requestUrl = appendAppID(requestUrl);

    return fetch(requestUrl)
        .then(convertPromiseToJSON)
        .then(verifyGood)
        .then((json) => {
            if(json.length < 1) {
                throw {reason: 'not found', payload: json};
            }
            return json;
        });
}

function currentWeather(lat, lon) {
    let requestUrl = formatURL(currentWeatherRoute);
    requestUrl += `?lat=${lat}&lon=${lon}&units=standard`;
    requestUrl = appendAppID(requestUrl);
    return fetch(requestUrl)
        .then(convertPromiseToJSON)
        .then(verifyGood)
        .then((json) => {
            let apiJson = {
                loc: {lat: lat, lon: lon, city: json.name},
                weather: json.weather,
                temp: convertKToF(json.main.temp),
                wind: convertMStoMPH(json.wind.speed),
                humidity: json.main.humidity
            };
            return apiJson; // rewrap this with all the info we need
        });
}

function fetchWeather(city, coords) {
    // if coordinates are available
    if(coords.lat && coords.lon) {
        // skip geocode, just make the weather request
        return currentWeather(coords.lat, coords.lon);
    }
    // otherwise we need to geocode, then make the request
    return directGeocode({name: city}).then((json) => currentWeather(json[0].lat, json[0].lon));
}

function fetchForecast(lat, lon) {
    let requestUrl = formatURL(forecastRoute);
    requestUrl += `?lat=${lat}&lon=${lon}`;
    requestUrl = appendAppID(requestUrl);
    return fetch(requestUrl)
        .then(convertPromiseToJSON)
        .then(verifyGood)
        .then((json) => {
            let daysWeatherList = [];
            let weatherList = json.list;
            for(let i = 0; i < weatherList.length; i++) {
                let weather = weatherList[i];
                let time = moment(weather.dt_txt);
                if(time.day() === moment().day()) {
                    continue;
                }
                let duplicateDay = false;
                for(let j = 0; j < daysWeatherList.length; j++) {
                    let daysWeather = daysWeatherList[j];
                    let daysWeatherTime = moment(daysWeather.dt_txt);
                    if(daysWeatherTime.day() === time.day()) {
                        duplicateDay = true;
                        break;
                    }
                }
                if(!duplicateDay) {
                    daysWeatherList.push(weather);
                }
            }
            let payload = [];
            for(let i = 0; i < daysWeatherList.length; i++) {
                let daysWeather = daysWeatherList[i];
                payload.push({
                    time: moment(daysWeather.dt_txt),
                    loc: {lat: json.city.coord.lat, lon: json.city.coord.lon, city: json.city.name},
                    weather: daysWeather.weather,
                    temp: convertKToF(daysWeather.main.temp),
                    wind: convertMStoMPH(daysWeather.wind.speed),
                    humidity: daysWeather.main.humidity
                });
            }
            return payload;
        });
}
