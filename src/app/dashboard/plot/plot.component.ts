import { Component, Input, OnChanges, AfterContentInit } from '@angular/core';

import Plotly from 'plotly.js-basic-dist-min';
import { Layout } from 'plotly.js-basic-dist-min';
import { IPlotData, ITopicPlotData } from '../../data.service';
import topicDefinitions from "../../../assets/static/json/topicDefinitions.json"

@Component({
  selector: 'app-plot',
  templateUrl: './plot.component.html',
  styleUrls: ['./plot.component.scss']
})
export class PlotComponent implements AfterContentInit, OnChanges {

  @Input() data!: Array<IPlotData>;
  @Input() currentStats!: string;
  @Input() topicPlotData!: Array<ITopicPlotData>;
  layout: Layout | any;

  content: any = {"users": 0, "edits": 1, "buildings": 2, "roads": 3}

  ngAfterContentInit(): void {
    this.initChart();

    if(this.data){
      this.refreshPlot();
    }
  }

  ngOnChanges(): void {
    if(this.data)
      this.refreshPlot();
  }

  /**
   * Draws the blank plotly chart. Traces will be added dynamically
   */
	initChart() {
		this.layout = {
			autosize: true,
			height: 350,
			grid: { rows: 1, columns: 1 },
			shapes: [],
			annotations: [],
			margin: { l: 50, r: 20, t: 20, b: 40 },
			legend: { orientation: 'h' },
      barmode: 'group',
      font: {
        family: 'Roboto, -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif'
      },

		};

    Plotly.react('summaryplot', [], this.layout, {responsive: true});

	}

  refreshPlot() {
    // todo: this will be different with multiple topics


    const currentDate = new Date()
    const topic_definitions = topicDefinitions as any
    const _data = this.data as any
    if (this.topicPlotData){
      if (this.topicPlotData.length != this.data.length){
        return // topic response usually arrives faster, but only want to update once both requests came through
      }
      let wrappedTopicPlotData: any = [this.topicPlotData]
      wrappedTopicPlotData.forEach((topic: Array<ITopicPlotData>)=>{
        for(let i=0; i<topic.length; i++){
          _data[i][topic[i].topic] = topic[i].value
        }
      })
    }
    const plotData : any = [{
      x: _data.map((e : IPlotData) => `${e.startDate}`),
      y: _data.map((e: any) => e[this.currentStats]),
      customdata: _data.map((e: any) => e[this.currentStats]),
      hovertext: this.data.map((e : IPlotData) => `From ${e.startDate}<br>To ${e.endDate}`),
      hovertemplate: `%{hovertext}<br>${topic_definitions[this.currentStats]["name"]}: %{customdata}<extra></extra>`,
      type: 'bar',
      name: `${topic_definitions[this.currentStats]["name"]}`,
      marker: {
        pattern: {
          // apply stripped pattern only for current running time
          shape: this.data.map((_ : IPlotData) => (currentDate >= new Date(_.startDate) && currentDate <= new Date(_.endDate)) ? '/' : ''),
          size: 7,
          solidity: 0.6
        },
        color: `${topic_definitions[this.currentStats]["color-hex"]}`
      },
    }];
    this.layout.yaxis.title = `${topic_definitions[this.currentStats]["y-title"]}`
    Plotly.react('summaryplot', plotData, this.layout, {responsive: true});
  }
}
