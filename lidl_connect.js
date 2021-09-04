username = '015221234567'
password = 'supergeheim'
apiUrl = 'https://api.lidl-connect.de/api'

fresh = 0
fm = FileManager.local()
path = fm.joinPath(fm.documentsDirectory(), "lidl_connect.json")

let widget = await createWidget()
if (!config.runsInWidget) {
  await widget.presentSmall()
}

Script.setWidget(widget)
Script.complete()


// get access token
async function getToken() {
  let req = new Request(apiUrl + '/token')
  req.method = 'POST';
  req.headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
  req.body = JSON.stringify({
    'client_id': 'lidl',
    'client_secret': 'lidl',
    'grant_type': 'password',
    'password': password,
    'username': username
  })

  try {
    let token = await req.loadJSON()
    return token['access_token']
  } catch (e) {
    console.log('Login failed!')
  }
}


// request data from server
async function getData() {
  let token = await getToken()
  let req = new Request(apiUrl + '/graphql')
  req.method = 'POST';
  req.headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer ' + token
  }

  req.body = JSON.stringify({
    'operationName': 'consumptions',
    'query': 'query consumptions {\n  consumptions {\n    consumptionsForUnit {\n      consumed\n      unit\n      formattedUnit\n      type\n      description\n      expirationDate\n      left\n      max\n      tariffOrOptions {\n        name\n        id\n        type\n        consumptions {\n          consumed\n          unit\n          formattedUnit\n          type\n          description\n          expirationDate\n          left\n          max\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n',
    'variables': {}
  })

  try {
    data = await req.loadJSON()
    fm.writeString(path, JSON.stringify(data, null, 2))
    fresh = 1
    extractUsage(data)
  } catch (e) {
    data = JSON.parse(fm.readString(path), null)
    if (!data) {
      console.log('Request failed!')
    }
  }
}


// extract data from response json
async function extractUsage(data) {
  let response = {}
  response['consumed'] = data['data']['consumptions']['consumptionsForUnit'][0]['consumed']
  response['max'] = data['data']['consumptions']['consumptionsForUnit'][0]['max']
  response['percentage'] = Math.round(response['consumed'] / response['max'] * 100)
  response['unit'] = data['data']['consumptions']['consumptionsForUnit'][0]['unit']
  response['expirationDate'] = Date.parse(data['data']['consumptions']['consumptionsForUnit'][0]['expirationDate'])
  let timeDiff = response['expirationDate'] - Date.parse(new Date())
  response['daysRemaining'] = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
  response['hoursRemaining'] = Math.floor((timeDiff / (1000 * 60 * 60)) % 24)
  fm.writeString(path, JSON.stringify(response, null, 2))
}


async function createWidget() {
  await getData()
  data = JSON.parse(fm.readString(path), null)
  const widget = new ListWidget()

  if (!data || !data['consumed']) {
    widget.addText("Initial execution requires internet connection.")
  } else {
    widget.addSpacer(16)
    try {
      const line1 = widget.addText('LIDL Connect')
      line1.font = Font.mediumSystemFont(12)

      let usedPercentage = data['percentage']
      const line2 = widget.addText(usedPercentage.toString() + '%')
      line2.font = Font.boldSystemFont(36)
      line2.textColor = Color.green()
      if (usedPercentage >= 75) {
        line2.textColor = Color.orange()
      } else if (usedPercentage >= 90) {
        line2.textColor = Color.red()
      }

      const line3 = widget.addText(data['consumed'].toString() + ' / ' + data['max'].toString() + ' ' + data['unit'])
      line3.font = Font.mediumSystemFont(12)
      widget.addSpacer(16)

      // add remaining time
      let line4, line5
      line4 = widget.addText('remaining time:')
      line4.font = Font.mediumSystemFont(12)

      if (data['daysRemaining'] > 2) {
        line5 = widget.addText((data['daysRemaining'] + 1).toString() + ' days')
      } else {
        line5 = widget.addText(data['daysRemaining'].toString() + ' days and ' + data['hoursRemaining'].toString() + ' hours')
      }
      line5.font = Font.mediumSystemFont(12)

      // gray out old data if request failed
      if (fresh == 0) {
        line1.textColor = Color.darkGray()
        line2.textColor = Color.darkGray()
        line3.textColor = Color.darkGray()
        line4.textColor = Color.darkGray()
        line5.textColor = Color.darkGray()
      }

    } catch (err) {
      widget.addText('Error fetching JSON')
      console.log(err)
    }
  }

  // add time of last refresh
  widget.addSpacer(4)
  let now = new Date();
  let timeLabel = widget.addDate(now)
  timeLabel.font = Font.mediumSystemFont(10)
  timeLabel.centerAlignText()
  timeLabel.applyTimeStyle()
  timeLabel.textColor = Color.darkGray()

  return widget
}