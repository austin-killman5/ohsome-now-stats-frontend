import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Input,
    OnChanges,
    SimpleChanges,
    ViewChild,
} from '@angular/core';

import Plotly from 'plotly.js-geo-dist';
import {Config} from 'plotly.js-basic-dist-min';
import {download, generateCsv, mkConfig} from "export-to-csv";
import {propertyOrderForCSV} from '../../data.service';
import {StatsType, ICountryStatsData} from '../types';
import topicDefinitions from "../../../assets/static/json/topicDefinitions.json"

export interface ICountryStatsDataAsArrays {
    country: string[],
    users: number[],
    roads: number[],
    buildings: number[],
    'amenity': number[],
    'commercial': number[],
    'education': number[],
    'financial': number[],
    'healthcare': number[],
    'lulc': number[],
    'place': number[],
    'poi': number[],
    'social_facility': number[],
    'wash': number[],
    'waterway': number[],
    edits: number[],
    latest: string[]
}

// Purples from d3-scale-chromatic at https://observablehq.com/@d3/color-schemes

@Component({
    selector: 'app-map',
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})

export class MapComponent implements OnChanges {
    @Input() data!: Array<ICountryStatsData>;
    @Input() currentStats!: StatsType;
    @Input() selectedCountries!: string;
    @Input() selectedTopics: string | undefined;

    @ViewChild('d3Map') d3MapElement: ElementRef | undefined;

    csvConfig = mkConfig({useKeysAsHeaders: true, filename: 'data_per_country'});
    @Input() isCountriesLoading!: boolean;

    ngOnChanges(changes: SimpleChanges): void {
        const data: Array<ICountryStatsData> = this.data
        const notSelectedCountryData: ICountryStatsData[] = [];
        const selectedCountryData = data.filter((dataPoint: any) => {
            if (this.selectedCountries.includes(dataPoint["country"])) {
                return true
            } else {
                notSelectedCountryData.push(dataPoint)
                return false
            }
        })

        const selectedCountryStatsArrays = this.selectedCountries != "" ?
            this.getSortedStatsFromData(selectedCountryData, this.currentStats)
            : this.getSortedStatsFromData(data, this.currentStats)
        const notSelectedCountryStatsArrays = this.selectedCountries != "" ?
            this.getSortedStatsFromData(notSelectedCountryData, this.currentStats)
            : this.getSortedStatsFromData([], this.currentStats)


        let cmin;
        let cmax;
        if (notSelectedCountryStatsArrays[this.currentStats]!.length != 0) {
            cmax = notSelectedCountryStatsArrays[this.currentStats]![0] > selectedCountryStatsArrays[this.currentStats]![0]
                ? notSelectedCountryStatsArrays[this.currentStats]![0]
                : selectedCountryStatsArrays[this.currentStats]![0]

            cmin = notSelectedCountryStatsArrays[this.currentStats]!.at(-1)! < selectedCountryStatsArrays[this.currentStats]!.at(-1)!
                ? notSelectedCountryStatsArrays[this.currentStats]!.at(-1)!
                : selectedCountryStatsArrays[this.currentStats]!.at(-1)!
        } else {
            cmax = selectedCountryStatsArrays[this.currentStats]![0]
            cmin = selectedCountryStatsArrays[this.currentStats]!.at(-1)!
        }

        // min should never be negative, otherwise the positive which is currently the only one displayed
        // can lose its color scale
        cmin = cmin > 0 ? cmin : 0;

        if (this.data && this.currentStats) {
            this.initPlotlyMap({
                selectedCountryStatsArrays: selectedCountryStatsArrays,
                notSelectedCountryStatsArrays: notSelectedCountryStatsArrays,
                stats: this.currentStats,
                cmin: cmin,
                cmax: cmax
            });
        }

    }

    getSortedStatsFromData(data: ICountryStatsData[], stats: StatsType): Partial<ICountryStatsDataAsArrays> {
        return data.sort((a, b) => b[stats]! - a[stats]!)
            .reduce<Partial<ICountryStatsDataAsArrays> & { country: string[] }>((previousValue, currentValue) => {
                previousValue["country"].push(currentValue["country"]);
                previousValue[stats]?.push(currentValue[stats]!);
                return previousValue;
            }, {
                country: [],
                [stats]: []
            })
    }

    initPlotlyMap({selectedCountryStatsArrays, notSelectedCountryStatsArrays, stats, cmin, cmax}: {
        selectedCountryStatsArrays: Partial<ICountryStatsDataAsArrays>;
        notSelectedCountryStatsArrays: Partial<ICountryStatsDataAsArrays>;
        stats: StatsType,
        cmin: number,
        cmax: number
    }) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const plotData: Data[] = [

            {
                type: 'scattergeo',
                mode: 'markers',
                geo: 'geo',
                locationmode: 'ISO-3',
                hoverinfo: 'location+text',
                hovertext: notSelectedCountryStatsArrays[stats],
                locations: notSelectedCountryStatsArrays.country,
                customdata: notSelectedCountryStatsArrays[stats],
                marker: {
                    size: notSelectedCountryStatsArrays[stats],
                    color: "#cccccc",
                    cmin: cmin,
                    cmax: cmax,
                    sizemode: 'area',
                    sizemin: 2,
                    // sizeref formula from https://stackoverflow.com/a/57422764
                    sizeref: cmax / 60 ** 2,
                    reversescale: false,
                    line: {
                        color: 'white'
                    }
                },
                name: "not selected"
            },
            {
                type: 'scattergeo',
                mode: 'markers',
                geo: 'geo',
                locationmode: 'ISO-3',
                hoverinfo: 'location+text',
                hovertext: selectedCountryStatsArrays[stats],
                locations: selectedCountryStatsArrays.country,
                customdata: selectedCountryStatsArrays[stats],
                marker: {
                    size: selectedCountryStatsArrays[stats],
                    color: selectedCountryStatsArrays[stats],
                    cmin: cmin,
                    cmax: cmax,
                    sizemode: 'area',
                    sizemin: 2,
                    // sizeref formula from https://stackoverflow.com/a/57422764
                    sizeref: cmax / 60 ** 2,
                    colorscale: topicDefinitions[stats]["color-scale"]
                        .map((value, index) => [index / 39, value]),
                    reversescale: false,
                    line: {
                        color: 'black'
                    },
                },
                showlegend: false
            }];

        const corner = window.innerWidth > 600 ? 1 : 0;
        const anchor = window.innerWidth > 600 ? "right" : "left";

        const layout = {
            margin: {
                t: 0, l: 0, b: 0, r: 0
            },
            autosize: true,
            geo: {
                scope: 'world',
                resolution: 110, // 50 => ca 1:50 Mio.
                showcountries: true,
                showland: true,
                landcolor: "#e5e5e5",
                showocean: true,
                oceancolor: '#f5f5f5',
                showframe: true,
                projection: {
                    type: 'robinson'
                }
            },
            legend: {
                x: corner,
                xanchor: anchor,
                y: corner
            },
            xaxis: {
                automargin: true
            }
        };

        const config: Partial<Config> = {
            responsive: true,
            displayModeBar: false,
            topojsonURL: "./assets/static/",
        };

        Plotly.newPlot('d3-map', plotData, layout, config);
    }

    downloadCsv() {
        // Converts your Array<Object> to a CsvOutput string based on the configs
        let selectedCountryCSV: Array<ICountryStatsData> = [];
        if (this.selectedCountries === '') {
            // if no country is selected than add all countries to CSV
            selectedCountryCSV = this.data
        } else {
            // filter only selected countries
            selectedCountryCSV = this.data.filter((dataPoint) => this.selectedCountries.includes(dataPoint["country"]))
        }

        if (selectedCountryCSV.length > 0) {
            selectedCountryCSV = this.sortArrayByCustomOrder(selectedCountryCSV)
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const csv = generateCsv(this.csvConfig)(selectedCountryCSV);
            download(this.csvConfig)(csv)
        }
        // console.log('selectedCountryCSV ', selectedCountryCSV)
    }

    sortArrayByCustomOrder(arr: Array<ICountryStatsData>): Array<ICountryStatsData> {

        return arr.map((obj) => {
            const sortedObj: ICountryStatsData = {} as ICountryStatsData;
            propertyOrderForCSV.forEach((property) => {
                if (property in obj) {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    sortedObj[property] = obj[property];
                }
            });
            return sortedObj;
        });
    }
}
