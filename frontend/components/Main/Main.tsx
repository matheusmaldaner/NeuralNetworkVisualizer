'use client';

import { Grid, Container, Table, Popover, Text, Group, Progress } from '@mantine/core';
import Image from 'next/image';
import classes from './Main.module.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

import { ReactFlow, MiniMap, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import EmperorPenguinBabyImage from '../../pics/EmperorPenguinBaby.jpeg';
import SouthernRockhopperPenguinImage from '../../pics/SouthernRockhopperPenguin.jpg';
import GentooPenguin from '../../pics/GentooPenguin.jpg';

import { AndGate, NorGate, OrGate, XorGate, NandGate, XnorGate, TrueGate, FalseGate, NotGate, PassThroughGate, ImplyGate, NotImplyGate, ImpliedByGate, NotImpliedByGate } from './nodes';
import { defaultEdges } from './edges';

import NodeGate from '../NodeGate';

import jsonData from '../../temp.json';
import { start } from 'repl';
import { input } from '@testing-library/user-event/dist/types/event';

import { ProbabilityTable } from '../ProbabilityPopup/ProbabilityPopup';

// Custom Node Component
const CustomNode = ({ id, data }) => {
  return (
    <div>
      {data.label}
      {/* Explicitly define source handles */}
      <div className="source-handle-a" data-handleid="a" />
      <div className="source-handle-b" data-handleid="b" />
    </div>
  );
};

export function Main(props: any) {
  const [leftImagePosition, setLeftImagePosition] = useState<{ top: number, left: number }>({ top: 0, left: 0 });
  const [centerImagePosition, setCenterImagePosition] = useState<{ top: number, left: number }>({ top: 0, left: 0 });

  const leftImageRef = useRef<HTMLImageElement | null>(null);
  const centerImageRef = useRef<HTMLImageElement | null>(null);

  const [defaultNodes, setDefaultNodes] = useState<any[]>([]);
  const [defaultEdges, setDefaultEdges] = useState<any[]>([]);

  const [hoveredNode, setHoveredNode] = useState<any | null>(null); // Track hovered node
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // Position of popover

  const [startGate, setStartGate] = useState('');


  const onNodesChange = useCallback(
    // @ts-ignore to suppress TypeScript error
    (changes) => setDefaultNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    // @ts-ignore to suppress TypeScript error
    (changes) => setDefaultEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  
  const [selectedImage, setSelectedImage] = useState(EmperorPenguinBabyImage);
  const [modelInfo, setModelInfo] = useState<any | null>(null);
  const [predClasses, setPrediction] = useState<any | null>(null);
  const [connections, setConnections] = useState<any | null>(null);
  const [probabilities, setProbabilities] = useState<any | null>(null);

  useEffect(() => {
    if (props.selectedImage === '/_next/static/media/EmperorPenguinBaby.7955bfc0.jpeg') {
      setSelectedImage(EmperorPenguinBabyImage);
    }
    else if (props.selectedImage === '/_next/static/media/SouthernRockhopperPenguin.ae32a423.jpg') {
      setSelectedImage(SouthernRockhopperPenguinImage);
    }
    else if (props.selectedImage === '/_next/static/media/GentooPenguin.8585d424.jpg') {
      setSelectedImage(GentooPenguin);
    }
    else{
      setSelectedImage(props.selectedImage);
    }
  }, [props.selectedImage]);

  useEffect(() => {
    setModelInfo(props.modelInfo);
    setPrediction(props.predClasses);
    setConnections(props.connections);
    setProbabilities(props.probabilities);
    console.log(props.connections)
  }, [props.modelInfo, props.predClasses, props.connections, props.probabilities]);

  useEffect(() => {
    if (leftImageRef.current) {
      const leftImageRect = leftImageRef.current.getBoundingClientRect();
      setLeftImagePosition({ top: (leftImageRect.top + leftImageRect.bottom) / 2, left: leftImageRect.right });
    }

    if (centerImageRef.current) {
      const centerImageRect = centerImageRef.current.getBoundingClientRect();
      setCenterImagePosition({ top: (centerImageRect.top + centerImageRect.bottom) / 2, left: centerImageRect.left });
    }
  }, []);

  useEffect(() => {
    console.log("Before connections:", connections);
    if (!connections || !Array.isArray(connections) || connections === null || connections === undefined) {
      return;
    }

    // Map gate strings to corresponding components
    const gateMap = {
      'zero': <FalseGate />,
      'and': <AndGate />,
      'not_implies': <NotImplyGate />,
      'a': <PassThroughGate />,
      'not_implied_by': <NotImpliedByGate />,
      'b': <PassThroughGate />,
      'xor': <XorGate />,
      'or': <OrGate />,
      'not_or': <NorGate />,
      'not_xor': <XnorGate />,
      'not_b': <NotGate/>,
      'implied_by': <ImpliedByGate/>,
      'not_a': <NotGate />,
      'implies': <ImplyGate/>,
      'not_and': <NandGate/>,
      'one': <TrueGate />,
    };

    // Create new nodes based on jsonData
    const newNodes = connections[0].map((node: { neuron_idx: number; gate: string; inputs: number[]; probabilities: Record<string, number>}) => {
      console.log('tomato');
      if(node.inputs === null || node.inputs === undefined) {
        console.log("No inputs for node", node.neuron_idx);
        return null;
      }
      const [left, right] = node.inputs;
      const nodeGate = new NodeGate(node.neuron_idx.toString(), node.gate, left.toString(), right.toString(), true, node.probabilities);
      console.log(nodeGate.displayNodeInfo());

      // @ts-ignore
      const gateComponent = gateMap[node.gate] || <div>Unknown Gate</div>;

      return {
        id: nodeGate.index, // Use index for id
        data: { label: gateComponent, probabilities: nodeGate.probabilities }, // Example label
        position: { x: Math.random() * 500, y: Math.random() * 500 }, // Random position
        style: {
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
          width: 'auto',
          height: 'auto',
          padding: 0,
        },
        sourcePosition: 'right',
        targetPosition: 'right',
      };
    }).filter(edge => edge !== null);

    const newEdges = connections[0].flatMap((node: { neuron_idx: number; gate: string; inputs: number[] }) => {
      if(node.inputs === null || node.inputs === undefined) {
        return [];
      }
      if (node.inputs.includes(-4096)) {
        setStartGate(node.neuron_idx.toString());
      }

      return node.inputs.map((inputIdx: number, index: number) => {
        let tar_han = 'a';
          if (index === 1 && node.gate !== 'not_a' && node.gate !== 'not_b' && node.gate !== 'zero' && node.gate !== 'one') {
            tar_han = 'b';
          }

          if (node.gate === 'not_a' && index === 1) {
            return [];
          }
          if (node.gate === 'not_b' && index === 0) {
            return [];
          }
          if (node.gate === 'one' && index === 0) {
            return [];
          }
          if (node.gate === 'zero' && index === 1) {
            return [];
          }

          // Handle other cases as before
          return {
            id: `e${inputIdx}-${node.neuron_idx}`,
            source: inputIdx.toString(),
            target: node.neuron_idx.toString(),
            targetHandle: tar_han,
            animated: true, // Optional: you can toggle the animation
          };
        }
      ).filter(edge => edge !== null);
    });
    

    newNodes.push({
      id: '-4097',
      type: 'input',
      data: {
        label: (
          <div style={{ width: 'auto', height: 'auto' }}>
            {selectedImage && <Image src={selectedImage} alt="Input Node" layout="intrinsic" width={500} height={500}  style={{ width: 'auto', height: 'auto' }}/>}
          </div>
        ),
      },
      position: { x: 50, y: 50 },
      style: { backgroundColor: '#6ede87', color: 'white' },
      // @ts-ignore to suppress TypeScript error for sourcePosition
      sourcePosition: 'right',
    })

    newEdges.push({
      id: 'e-4097-start',
      source: '-4097',
      target: startGate,
      targetHandle: 'a',
      animated: true,
    })

    // Update state with generated nodes
    setDefaultNodes(newNodes);
    setDefaultEdges(newEdges);

    console.log(newNodes)
    console.log(newEdges)
  }, [connections, selectedImage, startGate]); // Empty dependency array to run once on mount

  useEffect(() => {
    // Draw the lines using D3
    const svg = d3.select('#lines-svg');
    svg.selectAll('*').remove(); // Clear previous lines

    if (leftImagePosition && centerImagePosition) {
      const midX = (leftImagePosition.left + centerImagePosition.left) / 2; // midpoint
      const controlPointOffset = 50; // Adjust this value to change the curve's shape

      svg.append('path')
        .attr(
          'd',
          `M${leftImagePosition.left},${leftImagePosition.top} 
           C${midX},${leftImagePosition.top - controlPointOffset}, 
            ${midX},${centerImagePosition.top + controlPointOffset}, 
            ${centerImagePosition.left},${centerImagePosition.top}`
        )
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .attr('fill', 'none');
    }
  }, [leftImagePosition, centerImagePosition]);

  const nodeColor = (node: any) => {
    switch (node.type) {
      case 'input':
        return '#6ede87';
      case 'output':
        return '#6865A5';
      default:
        return '#ff0072';
    }
  };

  const renderProbabilityTable = (probabilities: Record<string, number>) => {
    return (
      <Table verticalSpacing="xs" style={{ maxWidth: '200px' }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Gate</Table.Th>
            <Table.Th>Probability</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {Object.entries(probabilities).map(([gate, prob]) => (
            <Table.Tr key={gate}>
              <Table.Td>{gate}</Table.Td>
              <Table.Td>
                <Group justify="space-between">
                  <Text fz="xs" c="teal" fw={700}>
                    {(prob * 100).toFixed(2)}%
                  </Text>
                  <Progress.Root>
                    <Progress.Section value={prob * 100} color="teal" />
                  </Progress.Root>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  return (
    <div style={{ height: '500px', width: '100%' }}> {/* Specify a height */}
    {/* @ts-ignore to suppress TypeScript error */}
    {defaultNodes.length > 0 && (
      <ReactFlow nodes={defaultNodes} edges={defaultEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={{custom: CustomNode}} fitView   onNodeMouseEnter={(event, node) => {
        setHoveredNode(node);
        setPopoverPosition({ x: event.clientX, y: event.clientY });
      }} onNodeMouseLeave={() => setHoveredNode(null)}>
        <MiniMap nodeColor={nodeColor} nodeStrokeWidth={3} zoomable pannable />

        {hoveredNode && hoveredNode.data.probabilities && (
          <Popover
            opened
            position="top"
            style={{
              position: 'absolute',
              top: popoverPosition.y - 100,
              left: popoverPosition.x + 10,
              pointerEvents: 'none',
              zIndex: 1000,
            }}
            shadow="sm"
          >
            <Popover.Target>
              <div />
            </Popover.Target>
            <Popover.Dropdown>
              <strong>{hoveredNode.data.label}</strong>
              {renderProbabilityTable(hoveredNode.data.probabilities)}
            </Popover.Dropdown>
          </Popover>
        )}

      </ReactFlow>
    )}
  </div>
  );
}
