String.prototype.getFormValue = function (fieldName) {
    // i = case insensitive, s = match newlines
    const re = new RegExp(`### ${fieldName}\\s*\\r?\\n([\\s\\S]*?)(?=###|$)`, 'i')
    const result = this.match(re)
    if (result) {
        return result[1].trim()
    } else {
        console.log(
            `Field '${fieldName}' was not found. Check if the template changed.`
        )
        return ''
    }
}

// Extract checkbox values
String.prototype.getCheckboxValues = function (fieldName) {
    const section = this.getFormValue(fieldName)
    if (!section) return []
    
    const checkboxPattern = /- \[([ xX])\] (.*?)(?=\n- \[|$)/gs
    const matches = [...section.matchAll(checkboxPattern)]
    
    return matches
        .filter(match => match[1].toLowerCase() === 'x')
        .map(match => match[2].trim())
}

// Format the body into a more appealing layout
function reformatBody(body) {
    // Get request type
    const requestTypes = body.getCheckboxValues('Request Type')
    const requestType = requestTypes.length > 0 ? requestTypes.join(', ') : 'Not specified'
    
    // Get all other fields
    const description = body.getFormValue('Description')
    const purpose = body.getFormValue('Purpose/Use Case')
    const goalAlignment = body.getFormValue('Goal Alignment')
    const impact = body.getFormValue('Impact')
    const specificDataPoints = body.getFormValue('Specific Data Points')
    const dataFormat = body.getFormValue('Data Formatting')
    const timeRange = body.getFormValue('Time Range')
    const segmentation = body.getFormValue('Segmentation') || 'None specified'
    const dataLocation = body.getFormValue('Data Location \\(If Applicable\\)') || 'Not provided'
    const expectedValues = body.getFormValue('Expected Correct Values \\(If Known\\)') || 'Not provided'
    const timeline = body.getFormValue('Timeline')
    const stakeholders = body.getFormValue('Stakeholders')
    const additionalContext = body.getFormValue('Additional Context') || 'None provided'

    // Create a visually appealing header
    let newBody = `# 📊 Data Request: ${requestType}

## 📋 Request Overview
${description}

`

    // Create an information card layout
    newBody += `## 🎯 Request Details

<table>
<tr>
  <th width="30%">Item</th>
  <th width="70%">Response</th>
</tr>
<tr>
  <td><strong>Purpose</strong></td>
  <td>${purpose}</td>
</tr>
<tr>
  <td><strong>Goal Alignment</strong></td>
  <td>${goalAlignment}</td>
</tr>
<tr>
  <td><strong>Impact</strong></td>
  <td>${impact}</td>
</tr>
<tr>
  <td><strong>Timeline</strong></td>
  <td>${timeline}</td>
</tr>
<tr>
  <td><strong>Stakeholders</strong></td>
  <td>${stakeholders}</td>
</tr>
</table>

## 📈 Data Specifications

<table>
<tr>
  <th width="30%">Item</th>
  <th width="70%">Response</th>
</tr>
<tr>
  <td><strong>Specific Data Points</strong></td>
  <td>${specificDataPoints}</td>
</tr>
<tr>
  <td><strong>Format</strong></td>
  <td>${dataFormat}</td>
</tr>
<tr>
  <td><strong>Time Range</strong></td>
  <td>${timeRange}</td>
</tr>
<tr>
  <td><strong>Segmentation</strong></td>
  <td>${segmentation}</td>
</tr>
<tr>
  <td><strong>Current Location</strong></td>
  <td>${dataLocation}</td>
</tr>
<tr>
  <td><strong>Expected Values</strong></td>
  <td>${expectedValues}</td>
</tr>
</table>
`

    // Add additional context if provided
    if (additionalContext !== 'None provided') {
        newBody += `
## 📝 Additional Context
${additionalContext}
`
    }

    // Add tracking section
    newBody += `
## 🔄 Request Status Tracking
| Status | Date | Notes |
|--------|------|-------|
| 🟡 Received | ${new Date().toISOString().split('T')[0]} | Request received and being reviewed |
|  |  |  |
`

    return newBody
}

module.exports = ({ github, context }) => {
    const labels = context.payload.issue.labels
    
    // Check if this is a data-request issue
    let isDataRequest = false
    for (const label of labels) {
        if (label.name === 'data-request') {
            isDataRequest = true
            break
        }
    }
    
    if (!isDataRequest) {
        console.log('::set-output name=applyChanges::false')
        return
    }

    // Process the data request
    const body = context.payload.issue.body
    
    // Get request types for additional labels
    const requestTypes = body.getCheckboxValues('Request Type')
    let labelsToAdd = []
    
    if (requestTypes.includes('New Data Request')) {
        labelsToAdd.push('new-data')
    }
    if (requestTypes.includes('Fix Broken Data Points')) {
        labelsToAdd.push('data-fix')
    }
    
    // Determine priority based on timeline
    const timeline = body.getFormValue('Timeline')
    const today = new Date()
    let targetDate = null
    
    try {
        // Try to parse date in MM/DD/YYYY format
        const [month, day, year] = timeline.split('/').map(Number)
        targetDate = new Date(year, month - 1, day)
        
        const daysDiff = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24))
        
        if (daysDiff <= 7) {
            labelsToAdd.push('priority-high')
        } else if (daysDiff <= 30) {
            labelsToAdd.push('priority-medium')
        } else {
            labelsToAdd.push('priority-low')
        }
    } catch (e) {
        // If date parsing fails, don't add priority label
        console.log('Could not parse timeline for priority: ', e)
    }
    
    // Format new title based on request type
    const requestType = requestTypes.length > 0 ? requestTypes[0] : 'Data Request'
    const description = body.getFormValue('Description')
    const shortDescription = description.length > 60 
        ? description.substring(0, 57) + '...' 
        : description
        
    const newTitle = `[${requestType}] ${shortDescription}`
    
    // Create formatted body
    const newBody = reformatBody(body)
    
    console.log('::set-output name=applyChanges::true')
    return {
        labelsToAdd: labelsToAdd,
        newTitle: newTitle,
        newBody: newBody
    }
}