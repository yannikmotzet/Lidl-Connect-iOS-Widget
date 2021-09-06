username = '015221234567'
password = 'supergeheim'
apiUrl = 'https://api.lidl-connect.de/api'

fresh = false
tariffBooked = false
fm = FileManager.local()
path = fm.joinPath(fm.documentsDirectory(), "lidl_connect.json")

let lidlConnectWidget = await createWidget()
if (!config.runsInWidget) {
  await lidlConnectWidget.presentSmall()
}

Script.setWidget(lidlConnectWidget)
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
async function getConsumptions() {
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
    if (data['data']['consumptions']['consumptionsForUnit'].length > 0) {
      extractConsumptions(data)
      tariffBooked = true
    } else {
      tariffBooked = false
    }
    fresh = true
  } catch (e) {
    data = JSON.parse(fm.readString(path), null)
    if (!data) {
      console.log('Request failed!')
    }
  }
}


// extract data from response json
async function extractConsumptions(data) {
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
  await getConsumptions()
  data = JSON.parse(fm.readString(path), null)
  const widget = new ListWidget()


  if (!data) {
    line1 = widget.addText("Für die initiale Ausführung wird eine Internetverbindung benötigt.")
    line1.font = Font.mediumSystemFont(16)
  } else if (fresh && !tariffBooked) {
    line1 = widget.addText("Aktuell ist kein Datentarif gebucht.")
    line1.font = Font.mediumSystemFont(16)
  } else {
    try {
      widget.addSpacer(7)
      const line1 = widget.addText('LIDL Connect')
      line1.font = Font.boldSystemFont(14)

      widget.addSpacer(3)
      let usedPercentage = data['percentage']
      const line2 = widget.addText(usedPercentage.toString() + '%')
      line2.font = Font.boldSystemFont(40)
      line2.textColor = Color.green()
      if (usedPercentage >= 75) {
        line2.textColor = Color.orange()
      } else if (usedPercentage >= 90) {
        line2.textColor = Color.red()
      }

      widget.addSpacer(3)
      const line3 = widget.addText(data['consumed'].toString() + ' ' + data['unit'] + ' / ' + data['max'].toString() + ' ' + data['unit'])
      line3.font = Font.boldSystemFont(12)

      // add remaining time
      widget.addSpacer(8)
      let line4
      let timeRemainingString = ''
      if (data['daysRemaining'] > 1) {
        timeRemainingString = (data['daysRemaining'] + 1).toString() + ' Tage übrig'
      } else {
        if (data['daysRemaining'] == 1) {
          timeRemainingString = '1 Tag & '
        }
        if (data['hoursRemaining'] == 1) {
          timeRemainingString += '1 Stunde übrig'
        } else {
          timeRemainingString += data['hoursRemaining'].toString() + ' Stunden übrig'
        }
      }
      line4 = widget.addText(timeRemainingString)
      line4.font = Font.mediumSystemFont(12)

      // gray out old data if request failed
      if (!fresh) {
        line1.textColor = Color.darkGray()
        line2.textColor = Color.darkGray()
        line3.textColor = Color.darkGray()
        line4.textColor = Color.darkGray()

      }

    } catch (err) {
      widget.addText('Error fetching JSON')
      console.log(err)
    }
  }

  // add time of last refresh
  widget.addSpacer(8)
  let now = new Date();
  let timeLabel = widget.addDate(now)
  timeLabel.font = Font.mediumSystemFont(10)
  timeLabel.centerAlignText()
  timeLabel.applyTimeStyle()
  timeLabel.textColor = Color.darkGray()

  return widget
}