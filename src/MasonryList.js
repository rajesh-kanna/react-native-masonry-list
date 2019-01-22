import React from "react";
import { FlatList } from "react-native";
import PropTypes from "prop-types";

import { resolveImage, resolveLocal } from "./model";
import {
	getItemSource,
	setItemSource,
	getImageSource,
	getImageUri,
	insertIntoColumn
} from "./utils";
import Column from "./Column";

export default class MasonryList extends React.PureComponent {
	static propTypes = {
        itemSource: PropTypes.array,
		images: PropTypes.array.isRequired,
		layoutDimensions: PropTypes.object.isRequired,
		containerWidth: PropTypes.number,

		columns: PropTypes.number,
		spacing: PropTypes.number,
		initialColToRender: PropTypes.number,
		initialNumInColsToRender: PropTypes.number,
		sorted: PropTypes.bool,
		backgroundColor: PropTypes.string,
		imageContainerStyle: PropTypes.object,
		renderIndividualHeader: PropTypes.func,
		renderIndividualFooter: PropTypes.func,
		masonryFlatListColProps: PropTypes.object,

		customImageComponent: PropTypes.object,
		customImageProps: PropTypes.object,
		completeCustomComponent: PropTypes.func,

		onPressImage: PropTypes.func,
		onLongPressImage: PropTypes.func,

		onEndReachedThreshold: PropTypes.number,
	};

	state = {
		_sortedData: []
	}

	componentWillMount() {
		if (this.props.containerWidth) {
			this.resolveImages(
				this.props.itemSource,
				this.props.images,
				this.props.layoutDimensions,
				this.props.columns,
				this.props.initialColToRender,
				this.props.initialNumInColsToRender,
				this.props.sorted
			);
		}
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.layoutDimensions.width && nextProps.layoutDimensions.height &&
			nextProps.layoutDimensions.columnWidth && nextProps.layoutDimensions.gutterSize &&
			nextProps.layoutDimensions.width !== this.props.layoutDimensions.width &&
			nextProps.layoutDimensions.height !== this.props.layoutDimensions.height &&
			!this.props.containerWidth) {
				this.resolveImages(
					nextProps.itemSource,
					nextProps.images,
					nextProps.layoutDimensions,
					nextProps.columns,
					nextProps.initialColToRender,
					nextProps.initialNumInColsToRender,
					nextProps.sorted
				);
		}
	}

    _getCalculatedDimensions(imgDimensions = { width: 0, height: 0 }, columnWidth, gutterSize) {
		const divider = imgDimensions.width / columnWidth;

		const newWidth = imgDimensions.width / divider;
		const newHeight = imgDimensions.height / divider;

		return { width: newWidth, height: newHeight, gutter: gutterSize };
  }
  
  addItems(images){
    	this.resolveImages(
      this.props.itemSource,
      images,
      this.props.layoutDimensions,
      this.props.columns,
      this.props.initialColToRender,
      this.props.initialNumInColsToRender,
      this.props.sorted
    );
  }

	resolveImages(
		itemSource,
		images,
		layoutDimensions,
		columns,
		initialColToRender,
		initialNumInColsToRender,
		sorted
	) {
		const firstRenderNum = initialColToRender * initialNumInColsToRender;
		let unsortedIndex = 0;
		let renderIndex = 0;
		let batchOne = [];

		let columnHeightTotals = [];
		let columnCounting = 1;
		let columnHighestHeight = null;
		function _assignColumns(image, nColumns) {
			const columnIndex = columnCounting - 1;
			const { height } = image.masonryDimensions;

			if (!columnHeightTotals[columnCounting - 1]) {
				columnHeightTotals[columnCounting - 1] = height;
			} else {
				columnHeightTotals[columnCounting - 1] = columnHeightTotals[columnCounting - 1] + height;
			}

			if (!columnHighestHeight) {
				columnHighestHeight = columnHeightTotals[columnCounting - 1];
				columnCounting = columnCounting < nColumns ? columnCounting + 1 : 1;
			} else if (columnHighestHeight <= columnHeightTotals[columnCounting - 1]) {
				columnHighestHeight = columnHeightTotals[columnCounting - 1];
				columnCounting = columnCounting < nColumns ? columnCounting + 1 : 1;
			}

			return columnIndex;
		}

		if (itemSource.length > 0) {
			images
				.map((item) => {
					const image = getItemSource(item, itemSource);
					const source = getImageSource(image);
					const uri = getImageUri(image);

					if (source) {
						image.source = source;
					} else {
						/* eslint-disable no-console */
						console.warn(
							"react-native-masonry-list",
							"Please provide a valid image field in " +
							"data images. Ex. source, uri, URI, url, URL"
						);
						/* eslint-enable no-console */
					}

					if (image.dimensions && image.dimensions.width && image.dimensions.height) {
						return resolveLocal(image, item, itemSource);
					}

					if (image.width && image.height) {
						return resolveLocal(image, item, itemSource);
					}

					if (uri) {
						return resolveImage(uri, image, item, itemSource);
					} else {
						/* eslint-disable no-console */
						console.warn(
							"react-native-masonry-list",
							"Please provide dimensions for your local images."
						);
						/* eslint-enable no-console */
					}
				})
				.map((resolveTask, index) => {
					if (resolveTask && resolveTask.fork) {
						resolveTask.fork(
							// eslint-disable-next-line handle-callback-err, no-console
							(err) => console.warn("react-native-masonry-list", "Image failed to load."),
							(resolvedData) => {
								const resolvedImage = getItemSource(resolvedData, itemSource);
								if (sorted) {
									resolvedData.index = index;
								} else {
									resolvedData.index = unsortedIndex;
									unsortedIndex++;
								}

								resolvedImage.masonryDimensions =
									this._getCalculatedDimensions(
										resolvedImage.dimensions,
										layoutDimensions.columnWidth,
										layoutDimensions.gutterSize
									);

								resolvedData.column = _assignColumns(resolvedImage, columns);

								const finalizedData = setItemSource(resolvedData, itemSource, resolvedImage);

								if (firstRenderNum - 1 > renderIndex) {
									const sortedData = insertIntoColumn(finalizedData, batchOne, sorted);
									batchOne = sortedData;
									renderIndex++;
								}
								else if (firstRenderNum - 1 === renderIndex) {
									const sortedData = insertIntoColumn(finalizedData, batchOne, sorted);
									batchOne = sortedData;
									this.setState({_sortedData: batchOne});
									renderIndex++;
								}
								else if (firstRenderNum - 1 <= renderIndex) {
									this.setState(state => {
										const sortedData = insertIntoColumn(finalizedData, state._sortedData, sorted);
										return {
											_sortedData: sortedData
										};
									});
									renderIndex++;
								}
							}
						);
					}
				});
		} else {
			images
				.map((image) => {
					const source = getImageSource(image);
					const uri = getImageUri(image);

					if (source) {
						image.source = source;
					} else {
						/* eslint-disable no-console */
						console.warn(
							"react-native-masonry-list",
							"Please provide a valid image field in " +
							"data images. Ex. source, uri, URI, url, URL"
						);
						/* eslint-enable no-console */
					}

					if (image.dimensions && image.dimensions.width && image.dimensions.height) {
						return resolveLocal(image);
					}

					if (image.width && image.height) {
						return resolveLocal(image);
					}

					if (uri) {
						return resolveImage(uri, image);
					} else {
						/* eslint-disable no-console */
						console.warn(
							"react-native-masonry-list",
							"Please provide dimensions for your local images."
						);
						/* eslint-enable no-console */
					}
				})
				.map((resolveTask, index) => {
					if (resolveTask && resolveTask.fork) {
						resolveTask.fork(
							// eslint-disable-next-line handle-callback-err, no-console
							(err) => console.warn("react-native-masonry-list", "Image failed to load."),
							(resolvedImage) => {
								if (sorted) {
									resolvedImage.index = index;
								} else {
									resolvedImage.index = unsortedIndex;
									unsortedIndex++;
								}

								resolvedImage.masonryDimensions =
									this._getCalculatedDimensions(
										resolvedImage.dimensions,
										layoutDimensions.columnWidth,
										layoutDimensions.gutterSize
									);

								resolvedImage.column = _assignColumns(resolvedImage, columns);

								if (firstRenderNum - 1 > renderIndex) {
									const sortedData = insertIntoColumn(resolvedImage, batchOne, sorted);
									batchOne = sortedData;
									renderIndex++;
								}
								else if (firstRenderNum - 1 === renderIndex) {
									const sortedData = insertIntoColumn(resolvedImage, batchOne, sorted);
									batchOne = sortedData;
									this.setState({_sortedData: batchOne});
									renderIndex++;
								}
								else if (firstRenderNum - 1 <= renderIndex) {
									this.setState(state => {
										const sortedData = insertIntoColumn(resolvedImage, state._sortedData, sorted);
										return {
											_sortedData: sortedData
										};
									});
									renderIndex++;
								}
							}
						);
					}
				});
		}
	}

	_onCallEndReach = () => {
		this.props.masonryFlatListColProps &&
		this.props.masonryFlatListColProps.onEndReached &&
			this.props.masonryFlatListColProps.onEndReached();
	}

	render() {
		return (
			<FlatList
      removeClippedSubviews disableVirtualization enableEmptySection
            shouldItemUpdate={(props, nextProps) => {
              return props.item !== nextProps.item
            }}
				style={{
					padding: (this.props.layoutDimensions.width / 100) * this.props.spacing / 2,
					backgroundColor: this.props.backgroundColor
				}}
				contentContainerStyle={{
					justifyContent: "space-between",
					flexDirection: "row",
					width: "100%"
				}}
				onEndReachedThreshold={this.props.onEndReachedThreshold}
				{...this.props.masonryFlatListColProps}
				onEndReached={this._onCallEndReach}
				initialNumToRender={
					this.props.initialColToRender
						? this.props.initialColToRender
						: this.props.columns
				}
				keyExtractor={(item, index) => "COLUMN-" + index.toString()}
				data={this.state._sortedData}
				renderItem={({item, index}) => {
					return (
						<Column
							data={item}
							itemSource={this.props.itemSource}
							initialNumInColsToRender={this.props.initialNumInColsToRender}
							layoutDimensions={this.props.layoutDimensions}
							backgroundColor={this.props.backgroundColor}
							imageContainerStyle={this.props.imageContainerStyle}
							spacing={this.props.spacing}
							key={`MASONRY-COLUMN-${index}`}

							customImageComponent={this.props.customImageComponent}
							customImageProps={this.props.customImageProps}
							completeCustomComponent={this.props.completeCustomComponent}

							onPressImage={this.props.onPressImage}
							onLongPressImage={this.props.onLongPressImage}

							renderIndividualHeader={this.props.renderIndividualHeader}
							renderIndividualFooter={this.props.renderIndividualFooter}
						/>
					);
				}}
			/>
		);
	}
}
