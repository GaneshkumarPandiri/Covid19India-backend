const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

app.use(express.json());
///API 1

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.body = payload;
        next();
      }
    });
  }
};

const convertingDBObjectToResponseObjectAPI2 = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};
app.get("/states/", authenticateToken, async (request, response) => {
  const statesQuery = `SELECT * FROM state;`;
  const stateResponse = await db.all(statesQuery);
  const statesResponseResult = await stateResponse.map((item) =>
    convertingDBObjectToResponseObjectAPI2(item)
  );
  response.send(statesResponseResult);
});

//API 3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const statesQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const stateResponse = await db.get(statesQuery);
  const statesResponseResult = convertingDBObjectToResponseObjectAPI2(
    stateResponse
  );
  response.send(statesResponseResult);
});

//API 4
const authenticateTokenPost = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request = request.body;
        next();
      }
    });
  }
};

app.post("/districts/", authenticateTokenPost, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const districtAddQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths ) 
                              VALUES ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`;
  const dbResponse = await db.run(districtAddQuery);
  response.send("District Successfully Added");
});
//API 5

const convertingDBObjectToResponseObjectAPI5 = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`;
    const districtResponse = await db.get(districtQuery);
    const districtResponseResult = convertingDBObjectToResponseObjectAPI5(
      districtResponse
    );
    response.send(districtResponseResult);
  }
);

//API 6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDelQuery = `DELETE FROM district WHERE district_id = '${districtId}';`;
    const districtDelResponse = await db.run(districtDelQuery);

    response.send("District Removed");
  }
);

//API 7

app.put(
  "/districts/:districtId/",
  authenticateTokenPost,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;

    const updateDistrict = `UPDATE district 
                            SET 
                                district_name = '${districtName}', 
                                state_id = '${stateId}', 
                                cases = '${cases}', 
                                cured = '${cured}', 
                                active = '${active}', 
                                deaths = '${deaths}' 
                            WHERE district_id = '${districtId}'; `;
    const district = await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);

//API 8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const stateSummaryQuery = `SELECT SUM(cases) as totalCases, SUM(cured) as totalCured, SUM(active) as totalActive, SUM(deaths) as totalDeaths FROM district WHERE state_id = '${stateId}';`;
    const stateSummaryResponse = await db.get(stateSummaryQuery);
    response.send(stateSummaryResponse);
  }
);

module.exports = app;
