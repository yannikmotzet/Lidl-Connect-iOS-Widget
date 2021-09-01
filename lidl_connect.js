let widget = await createWidget()
widget.backgroundColor = new Color("#DFE0D0")
if (!config.runsInWidget) {
  await widget.presentSmall()
}

Script.setWidget(widget)
Script.complete()

async function getToken() {
    url = "https://api.lidl-connect.de/api/token"
    username = "015221234567"
    password = "supergeheim"

    let req = new Request(url)
    req.method = "POST";
    req.headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    req.body = JSON.stringify({
      "client_id": "lidl",
      "client_secret": "lidl",
      "grant_type": "password",
      "password": password,
      "username": username
  })

    try {
        let token = await req.loadJSON()
        return token['access_token']
      } catch (e) {
        console.log("Login failed!")
        throw new Error(`Login failed with HTTP-Status-Code ${req.response.statusCode}`)
      }
}

async function getUsage() {
  let token = await getToken()
  let graphql = "https://api.lidl-connect.de/api/graphql"
  let req = new Request(graphql)
    req.method = "POST";
    req.headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + token
    }

    req.body = JSON.stringify({
      'operationName': "consumptions",
      'query': "query consumptions {\n  consumptions {\n    consumptionsForUnit {\n      consumed\n      unit\n      formattedUnit\n      type\n      description\n      expirationDate\n      left\n      max\n      tariffOrOptions {\n        name\n        id\n        type\n        consumptions {\n          consumed\n          unit\n          formattedUnit\n          type\n          description\n          expirationDate\n          left\n          max\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
      'variables': {}
  })

    try {
        let data = await req.loadJSON()
        response = {}
        response['consumed'] = data['data']['consumptions']['consumptionsForUnit'][0]['consumed']
        response['unit'] = data['data']['consumptions']['consumptionsForUnit'][0]['unit']
        response['max'] = data['data']['consumptions']['consumptionsForUnit'][0]['max']
        response['expirationDate'] = Date.parse(data['data']['consumptions']['consumptionsForUnit'][0]['expirationDate'])
        return response
      } catch (e) {
        console.log("Request failed!")
        throw new Error(`Request failed with HTTP-Status-Code ${req.response.statusCode}`)
      }
}

async function createWidget() {
  let data = await getUsage()
  
  const list = new ListWidget()
  list.addSpacer(16)

  try {   
    const line1 = list.addText('LIDL Connect')
    line1.font = Font.mediumSystemFont(12)

    let usedPercentage = Math.round(data['consumed'] / data['max'] * 100)
    const line2 = list.addText(usedPercentage.toString() + '%')
    line2.font = Font.boldSystemFont(36)
    line2.textColor = Color.green()
    if (usedPercentage >= 75) {
      line2.textColor = Color.orange()
    } else if (usedPercentage >= 90) {
      line2.textColor = Color.red()
    }
  
    const line3 = list.addText(data['consumed'].toString() + " / " + data['max'].toString() + data['unit'])
    line3.font = Font.mediumSystemFont(12)
    
    list.addSpacer(16)
    
    // add time till tariff expires
    if (data['expirationDate']) {
      let line4, line5
      line4 = list.addText("remaining time:")
      line4.font = Font.mediumSystemFont(12)

      milisec_diff = data['expirationDate'] - Date.now()
      let days_diff = Math.floor(milisec_diff / 1000 / 60 / (60 * 24))

      if (days_diff > 2){
        line5 = list.addText(days_diff.toString() + " days")
        line5.font = Font.mediumSystemFont(12)
      } else {
        let date_diff = new Date( milisec_diff );
        line5 = list.addText(days_diff.toString() + " days and " + date_diff.getHours() + " hours")
        line5.font = Font.mediumSystemFont(12)
      }      
    }
    
  } catch(err) {
    list.addText("Error fetching JSON")
    console.log(err)
  }

  // add time of last refresh
  list.addSpacer(4)
  const now = new Date();
  const timeLabel = list.addDate(now)
  timeLabel.font = Font.mediumSystemFont(10)
  timeLabel.centerAlignText()
  timeLabel.applyTimeStyle()
  timeLabel.textColor = Color.darkGray()
  
  return list
}