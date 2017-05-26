"use strict"

var DataCollection = Backbone.Collection.extend({
	initialize: function(models, opts){
		this.groups = this.getGroupsWidth(models)
	},

	getGroupsWidth: function(models){
		var groupNamePairs =
			models.reduce((acc, v, i)=>{
				var newAcc = _(acc).mapObject((vInner, kInner)=>{
					var value = v.get(kInner)
					if(_(vInner).contains(value)){
						return vInner
					} else {
						return _(vInner).concat(value)
					}
				})
				return newAcc
		},{
			year: [],
			department: [],
			brand: [],
			model: [],
			price: []
		})
		return groupNamePairs
	}
})

var ControlsModel = Backbone.Model.extend({
	defaults: {
		year: 'horizontal',
		department: 'horizontal',
		brand: 'vertical',
		model: 'vertical',
		type: 'none',
		price: 'none',
		select: 'sum'
	}
})

var ControlsView = Backbone.View.extend({
	initialize: function(opts){
		this.controlsModel = opts.controlsModel
		this.render()
		this.$el.find(".horizontal-controls").on('click', (ev)=>{
			this.controlsClick(ev)
		})
		this.$el.find(".vertical-controls").on('click', (ev)=>{
			this.controlsClick(ev)
		})
		this.$el.find(".method-controls").on('change', (ev)=>{
			this.selectClick(ev)
		})
	},
	controlsClick: function(ev){
		var field = $(ev.target).data('field')
		var possibleDirections = ['horizontal', 'vertical', 'none']
		if(!_.isUndefined(field)){
			var direction = $(ev.currentTarget).data('direction')
			this.controlsModel.set(field, direction)
			this.controlsModel.trigger('tableUpdate')
		}
	},
	selectClick: function(ev){
		var selectedValue = $(ev.currentTarget).val()
		if(this.controlsModel.get('select') !== selectedValue){
			this.controlsModel.set('select', selectedValue)
			this.controlsModel.trigger('tableUpdate')
		}
	},
	template: _.template($("#controls-template").html()),
	render: function(){
		this.$el.html(this.template)
	}
})

var TableView = Backbone.View.extend({
	initialize: function(opts) {
		this.controlsModel = opts.controlsModel
		this.dataCollection = opts.dataCollection
		this.controlsModel.on('tableUpdate', ()=>{this.updateTable()})
	},

	updateTable: function(){
		this.createTable()
	},

	createOrderGroup: function(){
		var fields = this.controlsModel.omit('select')
		var groups = {
			horizontal: _(fields)
				.chain()
				.pick((v,k)=>v==="horizontal")
				.keys()
				.value(),
			vertical: _(fields)
				.chain()
				.pick((v,k)=>v==="vertical")
				.keys()
				.value()
		}
		return groups
	},

	generateTableSide: function(obj, groupsArray, dimension){

		

		var tree = obj.reduce((accOuter, vOuter, kOuter)=>{

			var rowCoords = _(groupsArray).reduce((acc, v, i)=>{

				var name = vOuter.get(v)
				if(_.isEmpty(acc[name])){
					acc[name] = {}
				}
				return acc[name]
			}, accOuter)

			if(_.isArray(rowCoords.models)){
				rowCoords.models = rowCoords.models.concat(vOuter)
			} else {
				rowCoords.models = [vOuter]
			}

			return accOuter
		}, {})

		var coord = 0

		function recursiveCalculateWidth(obj){
			if(!obj.hasOwnProperty('models')){
				var withChildrenSpan = 
					_(obj)
						.chain()
						.omit('coord')
						.reduce((acc, v, k)=>{
							var updatedChild = recursiveCalculateWidth(v)
							acc[k] = updatedChild
							acc.span = acc.span + updatedChild.span
							return acc
						}, {span: 0})
						.value()

				return withChildrenSpan
			} else {
				var currentCoord = coord++
				obj.models.forEach((x)=>{
					x.set('_coord-'+dimension, currentCoord)
				})
				var newObj = {span: 1, coord: currentCoord}
				_(newObj).extend(obj)
				return newObj
			}
		}
		
		return recursiveCalculateWidth(tree)
	},


	createTable: function(){
		var groups = this.createOrderGroup()
		var leftGroups = groups.horizontal
		var topGroups = groups.vertical

		var leftSide = this.generateTableSide(this.dataCollection, leftGroups, "left")
		var topSide = this.generateTableSide(this.dataCollection, topGroups, "top")
		
		this.render(this.createVirtualTable(leftGroups, topGroups, leftSide, topSide))
	},

	createVirtualTable: function(leftGroups, topGroups, leftSide, topSide){
		var virtualTable = []
		var leftOffset = leftGroups.length
		var topOffset = topGroups.length + 1

		for (var i = 0; i <= leftSide.span + topOffset; i++) {
			virtualTable[i] = []
			for (var k = 0; k <= topSide.span + leftOffset; k++) {
				virtualTable[i][k] = "<!--"+ i + "|" + k +" -->"
			}
		}



		virtualTable[0][0] = "<td colspan="+ (leftOffset) +" rowspan="+ (topOffset-1)+">table</td>"

		//left side
		leftGroups.forEach((v, i)=>{
			virtualTable[leftOffset][i] = "<td"+ (i===leftGroups.length-1 ? " colspan=2 " : "") +">"+v+"</td>"
		})

		function leftSideRecH(obj, depth, currentPosition){
			_(obj).reduce((acc, v, k)=>{
				if(_.isObject(v) && v.hasOwnProperty('span')){
					var newPosition = v.span + acc.position
					var span = ""
					if(v.hasOwnProperty('models')){
						span = "rowspan="+ v.span +" colspan=2"
					} else {
						span = "rowspan="+ v.span
					}
					virtualTable[acc.position][depth] =
						"<td "+ span +" >"+k+"</td>"
					leftSideRecH(v, depth+1, acc.position)
					acc.position = newPosition
					return acc
				} else {
					return acc
				}

			},{position: currentPosition})
		}

		leftSideRecH(leftSide, 0, topOffset)

		//top side
		topGroups.forEach((v, i)=>{
			virtualTable[i][topOffset] = "<td"+ (i===topGroups.length ? " rowspan=1 " : "") +">"+v+"</td>"
		})

		function topSideRecH(obj, depth, currentPosition){
			_(obj).reduce((acc, v, k)=>{
				if(_.isObject(v) && v.hasOwnProperty('span')){
					var newPosition = v.span + acc.position
					var span = ""
					if(v.hasOwnProperty('models')){
						span = "colspan="+ v.span +" rowspan=2"
					} else {
						span = "colspan="+ v.span
					}
					virtualTable[depth][acc.position] =
						"<td "+ span +">"+k+"</td>"
					topSideRecH(v, depth+1, acc.position)
					acc.position = newPosition
					return acc
				} else {
					return acc
				}

			},{position: currentPosition})
		}

		topSideRecH(topSide, 0, topOffset+1)

		var dataTable = this.createVirtualTableForData(this.dataCollection, leftSide.span, topSide.span)

		for (var i = 0; i < leftSide.span; i++) {
			for (var k = 0; k < topSide.span; k++) {
				var tableCell = "<td>"+ dataTable[i][k] +"</td>"
				virtualTable[i + topOffset][k + leftOffset] = tableCell
			}
		}

		return virtualTable

	},

	createVirtualTableForData: function(dataCollection, tableHeight, tableWidth, fn){
		var virtualTable = []

		for (var i = 0; i <= tableHeight; i++) {
			virtualTable[i] = []
			for (var k = 0; k <= tableWidth; k++) {
				virtualTable[i][k] = 0
			}
		}

		dataCollection.forEach(x=>{
			var height = x.get('_coord-left')
			var width = x.get('_coord-top')
			virtualTable[height][width] = 
				virtualTable[height][width] + 1
		})

		return virtualTable
	},

	render: function(virtualTable){
		var html = _(virtualTable)
			.reduce((acc, x) => {
				return acc+"<tr>" +
				_(x).reduce((acc, y) => {
					return acc + y
				},"") +
				"</tr>"
			},"")
		this.$el.html("<table>"+html+"</table>")
	}
})

$(document).ready(()=>{
	var controlsModel = new ControlsModel({})
	var data = window.jsonData
	var dataCollection = new DataCollection(
			data.map((x)=>{ return new Backbone.Model(x)})
		)
	var controls = new ControlsView({
		el: "#main-controls",
		controlsModel: controlsModel
	})
	var table = new TableView({
		el: "#main-table",
		controlsModel: controlsModel,
		dataCollection: dataCollection
	})
	controlsModel.trigger('tableUpdate')
})